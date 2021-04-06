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
	 * @param {import('../').RestartHandler} [restartHandler]
	 */
	constructor(logger, sub, maxQuietPeriodMs, restartHandler) {
		/** @readonly */
		this.maxQuietPeriodMs = maxQuietPeriodMs
		/** @readonly */
		this.restartHandler = restartHandler
		/** @readonly @private */
		this._logger = logger
		/** @readonly @private */
		this._sub = sub
		/**
		 * Format: `projects/{projectId}/subscriptions/{subName}`
		 * @readonly @private
		 */
		this._subName = sub.name.split('/').slice(-1)[0]
		/** @readonly @private */
		this.__messageListener = (...args) => this._messageListener(...args)
		/** @readonly @private */
		this.__errorListener = (...args) => this._errorListener(...args)
		/** @private */
		this._loggedError = false
		Object.defineProperties(this, {
			maxQuietPeriodMs: { value: this.maxQuietPeriodMs, enumerable: true },
			restartHandler: { value: this.restartHandler },
			_logger: { value: this._logger, enumerable: false },
			_sub: { value: this._sub, writable: true },
			_subName: { value: this._subName, enumerable: true },
			__messageListener: { value: this.__messageListener },
			__errorListener: { value: this.__errorListener },
			_loggedError: { value: this._loggedError, writable: true },
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

	async _restart() {
		try {
			const orgSub = this._sub
			const newSub = await this.restartHandler(orgSub)
			if (newSub === orgSub) return // Sub not changed
			if (newSub) this._logger.info(`Re-created subscription: ${this._subName}`)
			return newSub // Restarted
		} catch (ex) {
			this._logger.error(`Failed to re-create subscription: ${this._subName}`, ex)
			throw ex
		}
	}

	/**
	 * @param {Date} nowDate
	 * @returns {Promise<Error | undefined>} Resolves to `Error` when not setup to restart, `undefined` when there's no need to restart, rejects when restart is needed.
	 */
	async _check(nowDate) {
		const err = this._doCheck(nowDate)

		if (!this.restartHandler) return err // Not setup to restart
		if (!err) return // No need to restart
		throw err // Restart
	}

	/**
	 * @param {Date} nowDate
	 * @returns {undefined | Error}
	 */
	_doCheck(nowDate) {
		if (!this.startedListeningAtDate) {
			this._logError('Not yet started listening to subscription:', this._subName, this)
			return new Error(`Not yet started listening to subscription (${this._subName})`)
		}

		if (this.lastMessageDate) {
			const lastMessageMin = nowDate.getTime() - this.maxQuietPeriodMs
			// Need to have a message since lastMessageMin
			if (this.lastMessageDate.getTime() < lastMessageMin) {
				const age = utils.ageOfMessage({ publishTime: this.lastMessageDate }) || 'never'
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