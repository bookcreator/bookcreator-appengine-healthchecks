'use strict'

const { inspect } = require('util')
const utils = require('./utils')

/**
 * @typedef {import('@google-cloud/pubsub').Subscription} Subscription
 */

module.exports = class SubscriptionInfo {

	/**
	 * @param {import('../').Logger} logger
	 * @param {Subscription} sub
	 * @param {number} maxQuietPeriodMs
	 * @param {(subscription: Subscription, callback: (err?: Error, newSubscription?: Subscription)) => void} [restartHandler]
	 */
	constructor(logger, sub, maxQuietPeriodMs, restartHandler) {
		Object.defineProperties(this, {
			maxQuietPeriodMs: { value: maxQuietPeriodMs, enumerable: true },
			restartHandler: { value: restartHandler },
			_logger: { value: logger, enumerable: false },
			_sub: { value: sub, writable: true },
			// Format: projects/{projectId}/subscriptions/{subName}
			_subName: { value: sub.name.split('/').slice(-1)[0], enumerable: true },
			__messageListener: { value: (...args) => this._messageListener(...args) },
			__errorListener: { value: (...args) => this._errorListener(...args) },
			_loggedError: { value: false, writable: true },
		})
	}

	startListening() {
		this._logger.info(`Start monitoring subscription: ${this._subName}`)

		this._sub.prependListener('message', this.__messageListener)
		this._sub.prependListener('error', this.__errorListener)

		this.startedListeningAtDate = new Date()
	}

	stopListening() {
		this._logger.info(`Stop monitoring subscription: ${this._subName}`)

		this._sub.removeListener('message', this.__messageListener)
		this._sub.removeListener('error', this.__errorListener)
	}

	_restart() {
		const self = this
		return new Promise((resolve, reject) => {
			self.restartHandler(self._sub, (restartErr, newSub) => {
				if (restartErr) {
					this._logger.error(`Failed to re-create subscription: ${self._subName}`, restartErr)
					return reject(restartErr)
				}
				if (newSub === self._sub) return resolve() // Sub not changed
				if (newSub) this._logger.info(`Re-created subscription: ${self._subName}`)
				return resolve(newSub) // Restarted
			})
		})
	}

	_check(nowDate) {
		const err = this._doCheck(nowDate)

		if (!this.restartHandler) return Promise.resolve(err) // Not setup to restart
		if (!err) return Promise.resolve() // No need to restart
		return Promise.reject(err) // Restart
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
			this._logger.debug('[Already reported]', ...args)
			return
		}
		this._loggedError = true
		this._logger.error(...args)
	}

	_messageListener(message) {
		const m = process.env.DEBUG ? undefined : { message }
		this._logger.info(`Received message [id=${message.id}] (sub: ${this._subName}) age - ${utils.ageOfMessage(message)} - last received at: ${this.lastMessageDate}`, m)

		// Update the last message date
		this.lastMessageDate = new Date()
	}

	_errorListener(err) {
		this._logger.warn(`Received error (sub: ${this._subName}):`, err)

		this.error = err
	}

	toString() {
		return inspect(this)
	}

	[inspect.custom](depth, opts) {
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