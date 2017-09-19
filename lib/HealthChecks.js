'use strict'

const { inspect } = require('util')
const logger = require('./logger')
const utils = require('./utils')
const Endpoint = require('./Endpoint')
const SubscriptionInfo = require('./SubscriptionInfo')

const DEFAULT_MAX_SUBSCRIPTION_QUIET_PERIOD_MS = 2 /* mins */ * (60 * 1000)

module.exports = class HealthChecks extends Function {
	
	constructor(opts = {}) {
		const self = (...args) => self.middleware(...args)
		Object.setPrototypeOf(self, HealthChecks.prototype)
		
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
		
		_addEndpoint('alive', opts.liveness)
		_addEndpoint('ready', opts.readiness)
		
		Object.defineProperties(self, {
			_subscriptions: { value: new Map() },
			__pubSubErrorListener: { value: self._pubSubErrorListener.bind(self) }
		})
		
		const { defaultMaxSubscriptionQuietPeriodMs = DEFAULT_MAX_SUBSCRIPTION_QUIET_PERIOD_MS } = opts
		self.maxSubscriptionQuietPeriodMs = defaultMaxSubscriptionQuietPeriodMs
		
		const { verboseErrorResponses = !(!process.env.DEBUG) } = opts
		self.verboseErrorResponses = verboseErrorResponses
		
		return self
	}
	
	setHealthy() {
		this._healthy.setValid()
	}
	
	setUnhealthy(value) {
		this._healthy.setError(value)
	}
	
	setAlive() {
		this._alive.setValid()
	}
	
	setDead(value) {
		this._alive.setError(value)
	}
	
	setReady() {
		this._ready.setValid()
	}
	
	setUnready(value) {
		this._ready.setError(value)
	}
	
	startMonitorPubSubSubscription(sub, maxQuietPeriodMs = this.maxSubscriptionQuietPeriodMs) {
		if (!utils.isPubSubSubscription(sub)) throw new Error('Not a PubSub subscription object')
		if (this._subscriptions.has(sub)) return
		logger.debug(`Start monitoring subscription: ${sub.name}`)
		
		const info = new SubscriptionInfo(sub, maxQuietPeriodMs)
		info.startListening()
		this._subscriptions.set(sub, info)
		sub.prependListener('error', this.__pubSubErrorListener)
	}
	
	stopMonitorPubSubSubscription(sub) {
		if (!utils.isPubSubSubscription(sub)) throw new Error('Not a PubSub subscription object')
		if (!this._subscriptions.has(sub)) return
		logger.debug(`Stop monitoring subscription: ${sub.name}`)
		
		const info = this._subscriptions.get(sub)
		info.stopListening()
		sub.removeListener('error', this.__pubSubErrorListener)
		this._subscriptions.delete(sub)
	}
	
	middleware(req, res, next) {
// 		logger.verbose('this', typeof this, this)
// 		logger.verbose('req', typeof req, req)
// 		logger.verbose('res', typeof res, res)
// 		logger.verbose('req', typeof next, next)
// 		logger.info('Path', req.path)
		
		// Do this before, so it changes the checkers state
		this._checkSubscriptions()
		
		for (const ep of [this._healthy, this._alive, this._ready]) {
			const handled = ep.middleware(req)
			if (handled !== false) {
				// Match
				if (handled) {
					const err = handled instanceof Error ? handled : new Error(handled)
					const status = err.statusCode || (typeof err.code === 'number' ? err.code : null) || 500
					res.status(status)
					if (this.verboseErrorResponses) {
						res.json(Object.assign({}, err))
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
	}
	
	_pubSubErrorListener(err) {
		this._setUnhealthyDead(err)
	}
	
	_checkSubscriptions() {
		const now = new Date()
		
		let reportedErr = null
		for (const [, info] of this._subscriptions) {
			const err = info._check(now)
			if (err) reportedErr = err
		}
		
		if (reportedErr) {
			this._setUnhealthyDead(reportedErr)
		}
	}
	
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
		s += ', pubsubSubscriptions: ['
		s += [...this._subscriptions]
				.map(([{ name }, info]) => `${name}: ${inspect(info, opts)}`)
				.join(', ')
		s += '], ['
		s += Object.keys(this)
				.filter(p => this[p] instanceof Endpoint && this[p].path)
				.map(p => inspect(this[p], opts))
				.join(', ')
		s += '] }'
		return s
	}
}
