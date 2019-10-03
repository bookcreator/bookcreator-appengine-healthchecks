'use strict'

const { inspect } = require('util')
const utils = require('./utils')
const Endpoint = require('./Endpoint')
const SubscriptionInfo = require('./SubscriptionInfo')

const DEFAULT_MAX_SUBSCRIPTION_QUIET_PERIOD_MS = 2 /* mins */ * (60 * 1000)

/**
 * @typedef {import('@google-cloud/pubsub').Subscription} Subscription
 * @typedef {{ path?: string = null, initialValue?: Error = null }} EndpointConfig
 * @typedef {(subscription: Subscription, callback: (err?: Error, newSubscription?: Subscription)) => void} RestartHandler
 *
 * @typedef {HealthChecks & Readonly<{
 *    maxSubscriptionQuietPeriodMs: number,
 *    verboseErrorResponses: boolean,
 *    _healthy: Endpoint,
 *    _alive?: Endpoint,
 *    _ready?: Endpoint,
 *    _subscriptions: Map<Subscription, import('./SubscriptionInfo')>,
 *    __pubSubErrorListener: (error: Error) => void
 * }>} _HealthChecks
 */

class HealthChecks extends Function {

	/**
	 * @param {Object} [opts={}]
	 * @param {number} [opts.maxSubscriptionQuietPeriodMs=DEFAULT_MAX_SUBSCRIPTION_QUIET_PERIOD_MS]
	 * @param {'string' | EndpointConfig} [opts.health]
	 * @param {'string' | EndpointConfig} [opts.liveness]
	 * @param {'string' | EndpointConfig} [opts.readiness]
	 * @param {boolean} [opts.updatedHealthChecks]
	 * @param {boolean} [opts.verboseErrorResponses]
	 */
	constructor(opts = {}) {
		/** @type {_HealthChecks} */
		const self = (...args) => self.middleware(...args)
		Object.setPrototypeOf(self, HealthChecks.prototype)

		/**
		 * @param {string} name
		 * @param {EndpointConfig} [config]
		 */
		const _addEndpoint = (name, config = {}) => {
			if (typeof config === 'string') config = { path: config }
			Object.defineProperty(self, `_${name}`, { value: new Endpoint(name, config), enumerable: true })
		}

		// Convert path to object
		if (typeof opts.health === 'string') opts.health = { path: opts.health }
		const {
			path: healthPath = '/_ah/health',
			initialValue: initiallyHealthy
		} = opts.health || {}
		_addEndpoint('healthy', {
			path: healthPath,
			initialValue: initiallyHealthy
		})

		if (opts.updatedHealthChecks) {
			opts.liveness = opts.liveness || '/liveness_check'
			opts.readiness = opts.readiness || '/readiness_check'
		}

		_addEndpoint('alive', opts.liveness)
		_addEndpoint('ready', opts.readiness)

		Object.defineProperties(self, {
			_subscriptions: { value: new Map() },
			__pubSubErrorListener: { value: self._pubSubErrorListener.bind(self) }
		})

		const { defaultMaxSubscriptionQuietPeriodMs = DEFAULT_MAX_SUBSCRIPTION_QUIET_PERIOD_MS } = opts
		self.maxSubscriptionQuietPeriodMs = defaultMaxSubscriptionQuietPeriodMs

		const { verboseErrorResponses = process.env.DEBUG } = opts
		self.verboseErrorResponses = !!verboseErrorResponses // Convert to boolean

		return self
	}

	setHealthy() {
		this._healthy.setValid()
	}

	/**
	 * @param {Error} value
	 */
	setUnhealthy(value) {
		this._healthy.setError(value)
	}

	setAlive() {
		this._alive.setValid()
	}

	/**
	 * @param {Error} value
	 */
	setDead(value) {
		this._alive.setError(value)
	}

	setReady() {
		this._ready.setValid()
	}

	/**
	 * @param {Error} value
	 */
	setUnready(value) {
		this._ready.setError(value)
	}

	/**
	 * @param {Subscription} sub
	 * @param {number} [maxQuietPeriodMs=this.maxSubscriptionQuietPeriodMs]
	 * @param {?RestartHandler} restartHandler
	 */
	startMonitorPubSubSubscription(sub, maxQuietPeriodMs = this.maxSubscriptionQuietPeriodMs, restartHandler) {
		if (typeof maxQuietPeriodMs === 'function') {
			restartHandler = maxQuietPeriodMs
			maxQuietPeriodMs = this.maxSubscriptionQuietPeriodMs
		}
		if (!utils.isPubSubSubscription(sub)) throw new Error('Not a PubSub subscription object')
		if (this._subscriptions.has(sub)) return

		const info = new SubscriptionInfo(sub, maxQuietPeriodMs, restartHandler)
		info.startListening()
		this._subscriptions.set(sub, info)
		sub.prependListener('error', this.__pubSubErrorListener)
	}

	/**
	 * @param {Subscription} sub
	 */
	stopMonitorPubSubSubscription(sub) {
		if (!utils.isPubSubSubscription(sub)) throw new Error('Not a PubSub subscription object')
		if (!this._subscriptions.has(sub)) return

		const info = this._subscriptions.get(sub)
		info.stopListening()
		sub.removeListener('error', this.__pubSubErrorListener)
		this._subscriptions.delete(sub)
	}

	/**
	 * @param {import('http').IncomingMessage} req
	 * @param {import('http').OutgoingMessage} res
	 * @param {() => void} next
	 */
	middleware(req, res, next) {
		// logger.verbose('this', typeof this, this)
		// logger.verbose('req', typeof req, req)
		// logger.verbose('res', typeof res, res)
		// logger.verbose('req', typeof next, next)
		// logger.info('Path', req.path)

		/** @type {_HealthChecks} */
		const self = this
		// Do this before, so it changes the checkers state
		this._checkSubscriptions(() => {

			for (const ep of [self._healthy, self._alive, self._ready]) {
				const handled = ep.middleware(req)
				if (handled !== false) {
					// Match
					if (handled) {
						const err = handled instanceof Error ? handled : new Error(handled)
						let statusCode = err.statusCode || (typeof err.code === 'number' ? err.code : null)
						if (statusCode < 100 || statusCode >= 600) {
							err.originalStatus = statusCode
							statusCode = null
						}
						res.status(statusCode || 500)
						if (self.verboseErrorResponses) {
							res.json(Object.assign({ statusCode, message: err.message }, err))
						} else {
							res.send(err.message)
						}
						return res.end()
					} else {
						return res.status(200).send('ok')
					}
				}
			}

			return next()
		})
	}

	/**
	 * @param {Error} err
	 */
	_pubSubErrorListener(err) {
		this._setUnhealthyDead(err)
	}

	/**
	 * @param {() => void} next
	 */
	_checkSubscriptions(next) {
		const now = new Date()

		/** @type {_HealthChecks} */
		const self = this

		const promises = []
		for (const [sub, info] of this._subscriptions) {
			promises.push(info._check(now).catch(err => {
				// Restart
				self.stopMonitorPubSubSubscription(sub)
				return info._restart().then(newSub => {
					if (!newSub) return Promise.resolve(err) // Same or no sub-created
					self.startMonitorPubSubSubscription(newSub, info.maxQuietPeriodMs, info.restartHandler)
				})
			}))
		}

		Promise.all(promises)
			.then(results => {
				const err = results.find(e => e)
				return err ? Promise.reject(err) : Promise.resolve()
			})
			.catch(err => self._setUnhealthyDead(err))
			.then(next)
	}

	/**
	 * @param {Error} err
	 */
	_setUnhealthyDead(err) {
		this.setUnhealthy(err)
		this.setDead(err)
	}

	toString() {
		return inspect(this)
	}

	inspect(depth, opts) {
		opts = Object.assign({}, opts, { depth: (opts.depth || 0) - 1 })
		let s = `${this.constructor.name} { `
		s += Object.keys(this)
			.filter(p => !(this[p] instanceof Endpoint))
			.map(p => `${p}: ${inspect(this[p], opts)}`)
			.join(', ')
		s += ', ['
		s += Object.keys(this)
			.filter(p => this[p] instanceof Endpoint && this[p].path)
			.map(p => inspect(this[p], opts))
			.join(', ')
		s += '], ['
		s += [...this._subscriptions]
			.map(([, info]) => inspect(info, opts))
			.join(', ')
		s += '] }'
		return s
	}
}

module.exports = HealthChecks