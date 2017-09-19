const assert = require('assert')
const { EventEmitter } = require('events')
const MockDate = require('mockdate')

const HealthChecks = require('..')

class Subscription extends EventEmitter {

	constructor() {
		super()
		this.name = 'dummy-sub'
		this.pubsub = {}
	}
}

describe('HealthChecks - pubsub', function() {
	
	const now = Date.now()

	before(function() {
		MockDate.set(now)
	})
	after(function() {
		MockDate.reset()
	})
	
	const sub = new Subscription()
	afterEach(function() {
		sub.removeAllListeners()
	})
	
	describe('listeners', function() {
		it('attaches listeners', function() {
			const initialMessageListenerCount = sub.listenerCount('message')
			const initialErrorListenerCount = sub.listenerCount('error')
			
			const hc = new HealthChecks()
			hc.startMonitorPubSubSubscription(sub)
			
			assert.strictEqual(sub.listenerCount('message'), initialMessageListenerCount + 1)
			assert.strictEqual(sub.listenerCount('error'), initialErrorListenerCount + 2)
		})
		it('detaches listeners', function() {
			const initialMessageListenerCount = sub.listenerCount('message')
			const initialErrorListenerCount = sub.listenerCount('error')
		
			const hc = new HealthChecks()
			hc.startMonitorPubSubSubscription(sub)
			hc.stopMonitorPubSubSubscription(sub)
			
			assert.strictEqual(sub.listenerCount('message'), initialMessageListenerCount)
			assert.strictEqual(sub.listenerCount('error'), initialErrorListenerCount)
		})
		it('sets unhealthy on error', function() {
			const hc = new HealthChecks()
			hc.startMonitorPubSubSubscription(sub)
			
			assert.strictEqual(hc._healthy.error, null)
			
			const err = new Error('Some error')
			sub.emit('error', err)
			
			assert.strictEqual(hc._healthy.error, err)
		})
	})
})