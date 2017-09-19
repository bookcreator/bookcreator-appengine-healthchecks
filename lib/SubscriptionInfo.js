'use strict'

const logger = require('./logger')
const utils = require('./utils')

module.exports = class SubscriptionInfo {
	
	constructor(sub, maxQuietPeriodMs) {
		Object.defineProperty(this, 'maxQuietPeriodMs', { value: maxQuietPeriodMs, enumerable: true })
		
		Object.defineProperties(this, {
			_sub: { value: sub },
			__messageListener: { value: (...args) => this._messageListener(...args) },
			__errorListener: { value: (...args) => this._errorListener(...args) }
		})
	}
	
	startListening() {
		this._sub.prependListener('message', this.__messageListener)
		this._sub.prependListener('error', this.__errorListener)
		
		this.startedListeningAtDate = new Date()
	}
	
	stopListening() {
		this._sub.removeListener('message', this.__messageListener)
		this._sub.removeListener('error', this.__errorListener)
	}
	
	_check(nowDate) {
		if (!this.startedListeningAtDate) {
			logger.error('Not yet started listening to subscription:', this._sub.name, this)
			return new Error(`Not yet started listening to subscription (${this._sub.name})`)
		} else {
			if (this.lastMessageDate) {
				const lastMessageMin = nowDate.getTime() - this.maxQuietPeriodMs
				// Need to have a message since lastMessageMin
				if (this.lastMessageDate.getTime() < lastMessageMin) {
					const age = utils.ageOfMessage({ timestamp: this.lastMessageDate.getTime() }) || 'never'
					logger.error('Subscription alive check failed:', this._sub.name, this)
					return new Error(`Subscription ${this._sub.name} has not received a message for ${age}`)
				}
			} else {
				// Need to have started listening before lastMessageMin
				const lastMessageMin = nowDate.getTime() - this.maxQuietPeriodMs
				// Need to have a message since lastMessageMin
				if (this.startedListeningAtDate.getTime() < lastMessageMin) {
					logger.error('Subscription never received a message:', this._sub.name, this)
					return new Error(`Subscription ${this._sub.name} has never received a message`)
				}
			}
		}
		return
	}
	
	_messageListener(message) {
		logger.verbose(`Received message (sub: ${this._sub.name}) age - ${utils.ageOfMessage(message)} [id=${message.id}]`, message)
		
		logger.debug(`Last received a message for ${this._sub.name} at: ${this.lastMessageDate}`)
		
		// Update the last message date
		this.lastMessageDate = new Date()
	}
	
	_errorListener(err) {
		logger.verbose(`Received error (sub: ${this._sub.name}):`, err)
		
		this.error = err
	}
}