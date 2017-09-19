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
	}
	
	stopListening() {
		this._sub.removeListener('message', this.__messageListener)
		this._sub.removeListener('error', this.__errorListener)
	}
	
	_check(nowDate) {
		const lastMessage = this.lastMessageDate ? this.lastMessageDate.getTime() : 0
		const lastMessageMin = nowDate.getTime() - this.maxQuietPeriodMs
		// Need to have a message since lastMessageMin
		if (lastMessage < lastMessageMin) {
			const age = utils.ageOfMessage({ timestamp: lastMessageMin - lastMessage }) || 'never'
			logger.error('Subscription alive check failed:', this._sub.name, this)
			return new Error(`Subscription ${this._sub.name} has not received a message for ${age}`)
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