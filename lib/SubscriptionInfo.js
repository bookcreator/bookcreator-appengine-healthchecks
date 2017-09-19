const logger = require('./logger')
const utils = require('./utils')

module.exports = class SubscriptionInfo {
	
	constructor(maxQuietPeriodMs) {
		Object.defineProperty(this, 'maxQuietPeriodMs', { value: maxQuietPeriodMs, enumerable: true })
	}
	
	startListening(sub) {
		sub.prependListener('message', this._messageListener.bind(this, sub))
		sub.prependListener('error', this._errorListener.bind(this, sub))
	}
	
	stopListening(sub) {
		sub.removeListener('message', this._messageListener.bind(this, sub))
		sub.removeListener('error', this._errorListener.bind(this, sub))
	}
	
	_check({ name: subName }, nowDate) {
		const lastMessage = this.lastMessageDate ? this.lastMessageDate.getTime() : 0
		const lastMessageMin = nowDate.getTime() - this.maxQuietPeriodMs
		// Need to have a message since lastMessageMin
		if (lastMessage < lastMessageMin) {
			const age = utils.ageOfMessage({ timestamp: lastMessageMin - lastMessage }) || 'never'
			logger.error('Subscription alive check failed:', subName, this)
			return new Error(`Subscription ${subName} has not received a message for ${age}`)
		}
		return
	}
	
	_messageListener({ name: subName }, message) {
		logger.verbose(`Received message (sub: ${subName}) age - ${utils.ageOfMessage(message)} [id=${message.id}]`, message)
		
		logger.debug(`Last received a message for ${subName} at: ${this.lastMessageDate}`)
		
		// Update the last message date
		this.lastMessageDate = new Date()
	}
	
	_errorListener(sub, err) {
		this.error = err
	}
}