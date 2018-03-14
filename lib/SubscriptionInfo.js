'use strict'

const { inspect } = require('util')
const logger = require('./logger')
const utils = require('./utils')

module.exports = class SubscriptionInfo {

	constructor(sub, maxQuietPeriodMs) {
		Object.defineProperty(this, 'maxQuietPeriodMs', { value: maxQuietPeriodMs, enumerable: true })

		Object.defineProperties(this, {
			_sub: { value: sub },
			__messageListener: { value: (...args) => this._messageListener(...args) },
			__errorListener: { value: (...args) => this._errorListener(...args) },
			_loggedError: { value: false, writable: true },
		})
	}

	get _subName() {
		// Format: projects/{projectId}/subscriptions/{subName}
		return this._sub.name.split('/').slice(-1)[0]
	}

	startListening() {
		logger.info(`Start monitoring subscription: ${this._subName}`)

		this._sub.prependListener('message', this.__messageListener)
		this._sub.prependListener('error', this.__errorListener)

		this.startedListeningAtDate = new Date()
	}

	stopListening() {
		logger.info(`Stop monitoring subscription: ${this._subName}`)

		this._sub.removeListener('message', this.__messageListener)
		this._sub.removeListener('error', this.__errorListener)
	}

	_check(nowDate) {
		return Promise.resolve(this._doCheck(nowDate))
	}

	_doCheck(nowDate) {
		if (!this.startedListeningAtDate) {
			this._logError('Not yet started listening to subscription:', this._subName, this)
			return new Error(`Not yet started listening to subscription (${this._subName})`)
		}

		if (this.lastMessageDate) {
			const lastMessageMin = nowDate.getTime() - this.maxQuietPeriodMs
			// Need to have a message since lastMessageMin
			if (this.lastMessageDate.getTime() < lastMessageMin) {
				const age = utils.ageOfMessage({ timestamp: this.lastMessageDate.getTime() }) || 'never'
				this._logError('Subscription alive check failed:', this._subName, this)
				return new Error(`Subscription ${this._subName} has not received a message for ${age}`)
			}
		} else {
			// Need to have started listening before lastMessageMin
			const lastMessageMin = nowDate.getTime() - this.maxQuietPeriodMs
			// Need to have a message since lastMessageMin
			if (this.startedListeningAtDate.getTime() < lastMessageMin) {
				this._logError('Subscription never received a message:', this._subName, this)
				return new Error(`Subscription ${this._subName} has never received a message`)
			}
		}

		return
	}

	_logError(...args) {
		if (this._loggedError) {
			return logger.debug('[Already reported]', ...args)
		}
		this._loggedError = true
		logger.error(...args)
	}

	_messageListener(message) {
		const m = process.env.DEBUG ? undefined : { message }
		logger.info(`Received message [id=${message.id}] (sub: ${this._subName}) age - ${utils.ageOfMessage(message)} - last received at: ${this.lastMessageDate}`, m)

		// Update the last message date
		this.lastMessageDate = new Date()
	}

	_errorListener(err) {
		logger.warn(`Received error (sub: ${this._subName}):`, err)

		this.error = err
	}

	toString() {
		return inspect(this)
	}

	inspect(depth, opts) {
		opts = Object.assign({}, opts, { depth: (opts.depth || 0) - 1 })
		let s = `${this.constructor.name} { `
		s += `subName: ${this._subName}, `
		s += Object.keys(this)
			.map(p => `${p}: ${inspect(this[p], opts)}`)
			.join(', ')
		s += ' }'
		return s
	}
}