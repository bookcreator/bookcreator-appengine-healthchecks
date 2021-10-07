'use strict'

const { inspect } = require('util')
const utils = require('./utils')
const Endpoint = require('./Endpoint')
const SubscriptionInfo = require('./SubscriptionInfo')

const DEFAULT_MAX_SUBSCRIPTION_QUIET_PERIOD_MS = 2 /* mins */ * (60 * 1000)

/**
 * @typedef {import('@google-cloud/pubsub').Subscription} Subscription
 *
 * @typedef {import('../').HealthChecks & Readonly<{
 *    _logger: import('../').Logger,
 *    _alive: Endpoint,
 *    _ready: Endpoint,
 *    _subscriptions: Map<Subscription, import('./SubscriptionInfo')>,
 *    __pubSubErrorListener(error: Error): void,
 *    _checkSubscriptions(next: () => void): void
 * }>} _HealthChecks
 */

class HealthChecks extends Function {

	/**
	 * @this {_HealthChecks}
	 * @param {import('../').HealthChecksConfig} [opts]
	 */
	constructor(opts = {}) {
		super()
		/** @type {import('express-serve-static-core').RequestHandler & _HealthChecks} */
		// @ts-ignore
		const self = (...args) => self.middleware(...args)
		Object.setPrototypeOf(self, HealthChecks.prototype)

		/** @type {import('../').Logger} */
		const logger = {
			debug(...args) {
				if (opts.logger) opts.logger.debug(...args)
			},
			info(...args) {
				if (opts.logger) opts.logger.info(...args)
			},
			warn(...args) {
				if (opts.logger) opts.logger.warn(...args)
			},
			error(...args) {
				if (opts.logger) opts.logger.error(...args)
			},
		}
		// @ts-ignore
		self._logger = logger

		/**
		 * @param {string} name
		 * @param {import('../').EndpointConfig | string} [config]
		 */
		const _addEndpoint = (name, config = {}) => {
			// Convert path to object
			if (typeof config === 'string') config = { path: config }
			Object.defineProperty(self, `_${name}`, { value: new Endpoint(name, { ...config, logger }), enumerable: true })
		}

		opts.liveness = opts.liveness ?? '/liveness_check'
		opts.readiness = opts.readiness ?? '/readiness_check'

		_addEndpoint('alive', opts.liveness)
		_addEndpoint('ready', opts.readiness)

		Object.defineProperties(self, {
			_subscriptions: { value: new Map(), enumerable: false },
			__pubSubErrorListener: { value: self.setDead.bind(self), enumerable: false }
		})

		const { defaultMaxSubscriptionQuietPeriodMs = DEFAULT_MAX_SUBSCRIPTION_QUIET_PERIOD_MS } = opts
		// @ts-ignore
		self.maxSubscriptionQuietPeriodMs = defaultMaxSubscriptionQuietPeriodMs

		const { verboseErrorResponses = process.env.DEBUG } = opts
		self.verboseErrorResponses = !!verboseErrorResponses // Convert to boolean

		// @ts-ignore
		return self
	}

	/** @this {_HealthChecks} */
	setAlive() {
		this._alive.setValid()
	}

	/**
	 * @this {_HealthChecks}
	 * @param {Error} value
	 */
	setDead(value) {
		this._alive.setError(value)
	}

	/** @this {_HealthChecks} */
	setReady() {
		this._ready.setValid()
	}

	/**
	 * @this {_HealthChecks}
	 * @param {Error} value
	 */
	setUnready(value) {
		this._ready.setError(value)
	}

	/**
	 * @this {_HealthChecks}
	 * @param {Subscription} sub
	 * @param {number} [maxQuietPeriodMs]
	 * @param {?import('../').RestartHandler} [restartHandler]
	 */
	startMonitorPubSubSubscription(sub, maxQuietPeriodMs = -1, restartHandler) {
		if (typeof maxQuietPeriodMs === 'function') {
			restartHandler = maxQuietPeriodMs
			maxQuietPeriodMs = -1
		}
		if (!utils.isPubSubSubscription(sub)) throw new Error('Not a PubSub subscription object')
		if (this._subscriptions.has(sub)) return

		const info = new SubscriptionInfo(this._logger, sub, maxQuietPeriodMs === -1 ? this.maxSubscriptionQuietPeriodMs : maxQuietPeriodMs, restartHandler)
		info.startListening()
		this._subscriptions.set(sub, info)
		sub.prependListener('error', this.__pubSubErrorListener)
	}

	/**
	 * @this {_HealthChecks}
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
	 * @this {_HealthChecks}
	 * @param {import('express-serve-static-core').Request} req
	 * @param {import('express-serve-static-core').Response} res
	 * @param {import('express-serve-static-core').NextFunction} next
	 */
	middleware(req, res, next) {
		// this._logger.debug('this', typeof this, this)
		// this._logger.debug('req', typeof req, req)
		// this._logger.debug('res', typeof res, res)
		// this._logger.debug('req', typeof next, next)
		// this._logger.info('Path', req.path)

		/** @type {_HealthChecks} */
		const self = this
		// Do this before, so it changes the checkers state
		this._checkSubscriptions(() => {

			for (const ep of [self._alive, self._ready]) {
				const handled = ep.middleware(req)
				if (handled !== false) {
					// Match
					if (handled) {
						const err = handled instanceof Error ? handled : new Error(handled)
						// @ts-ignore
						let statusCode = err.statusCode || (typeof err.code === 'number' ? err.code : null)
						if (statusCode < 100 || statusCode >= 600) {
							// @ts-ignore
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
	 * @this {_HealthChecks}
	 * @param {() => void} next
	 */
	_checkSubscriptions(next) {
		const now = new Date()

		Promise.all([...this._subscriptions].map(async ([sub, info]) => {
			try {
				return await info._check(now)
			} catch (ex) {
				// Restart
				this.stopMonitorPubSubSubscription(sub)
				const newSub = await info._restart()
				if (!newSub) return ex // Same or no sub-created
				this.startMonitorPubSubSubscription(newSub, info.maxQuietPeriodMs, info.restartHandler)
			}
		}))
			.then(results => {
				const err = results.find(e => e)
				if (err) this.setDead(err)
			}, err => this.setDead(err))
			.finally(next)
	}

	/** @this {_HealthChecks} */
	toString() {
		return inspect(this)
	}

	/** @this {_HealthChecks} */
	[inspect.custom](depth, opts) {
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