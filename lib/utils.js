'use strict'

const { EventEmitter } = require('events')

module.exports.isPubSubSubscription = sub => (sub instanceof EventEmitter) && (typeof ('pubsub' in sub ? sub.pubsub : sub.parent) === 'object')

module.exports.ageOfMessage = message => {
	if (!message || !(message.timestamp instanceof Date)) return null

	const f = (s, m = null, h = null, d = null) => {
		let t = `${s.toFixed(3)}s`
		if (m !== null) t = `${m}m ${t}`
		if (h !== null) t = `${h}h ${t}`
		if (d !== null) t = `${d}d ${t}`
		return t
	}
	
	const millis = Date.now() - message.timestamp.getTime()

	const s = millis / 1000
	if (s < (5 * 60)) {
		// Less than 5 mins, report in seconds
		return f(s)
	} else if (s < (2 * (60 * 60))) {
		// Less than 2 hours, report in minutes
		const secs = s % 60
		const mins = (s - secs) / 60
		return f(secs, mins)
	} else if (s < (24 * (60 * 60))) {
		// Less than day, report in hours
		const secs = s % 60
		const mins = ((s - secs) / 60) % 60
		const hours = (s - (mins * 60) - secs) / (60 * 60)
		return f(secs, mins, hours)
	} else {
		const secs = s % 60
		const mins = ((s - secs) / 60) % 60
		const hours = ((s - (mins * 60) - secs) / (60 * 60)) % 24
		const days = (s - (hours * 60 * 60) - (mins * 60) - secs) / (60 * 60 * 24)
		return f(secs, mins, hours, days)
	}
}
