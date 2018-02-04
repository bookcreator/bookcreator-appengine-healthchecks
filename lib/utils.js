'use strict'

module.exports.isPubSubSubscription = sub => {
	if (sub && typeof sub === 'object' && (sub.constructor && sub.constructor.name === 'Subscription')) {
		// Correct class
		if ('pubsub' in sub) return typeof sub.pubsub === 'object'
		if ('parent' in sub) return typeof sub.parent === 'object' // v0.11
	}
	return false
}

module.exports.ageOfMessage = message => {
	if (!message) return null
	let ts = 'publishTime' in message ? message.publishTime : message.timestamp
	if (!ts || !(ts instanceof Date)) return null

	const f = (s, m = null, h = null, d = null) => {
		let t = `${s.toFixed(3)}s`
		if (m !== null) t = `${m}m ${t}`
		if (h !== null) t = `${h}h ${t}`
		if (d !== null) t = `${d}d ${t}`
		return t
	}
	
	const millis = Date.now() - ts.getTime()

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
