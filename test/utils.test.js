const assert = require('assert')
const { EventEmitter } = require('events')
const MockDate = require('mockdate')
const PubSub = require('@google-cloud/pubsub')

const utils = require('../lib/utils')

describe('utils.ageOfMessage', function() {
	
	const now = Date.now()

	before(function() {
		MockDate.set(now)
	})
	after(function() {
		MockDate.reset()
	})

	it('valid messages', function() {
	
		const mockMessage = (s = 0, m = 0, h = 0, d = 0) => {
			let ms = d * 24 * 60 * 60.0
			ms += h * 60 * 60
			ms += m * 60
			ms += s
			ms *= 1000
		
			const message = {
				timestamp: new Date(now - ms)
			}
			
			return utils.ageOfMessage(message)
		}
		
		assert.strictEqual(mockMessage(0), '0.000s')
		assert.strictEqual(mockMessage(0.0001), '0.001s')
		assert.strictEqual(mockMessage(0.00049), '0.001s')
		assert.strictEqual(mockMessage(0.0005), '0.001s')
		assert.strictEqual(mockMessage(0.01), '0.010s')
		assert.strictEqual(mockMessage(1), '1.000s')
		assert.strictEqual(mockMessage(59, 4), '299.000s')
		assert.strictEqual(mockMessage(0, 5), '5m 0.000s')
		assert.strictEqual(mockMessage(1, 5), '5m 1.000s')
		assert.strictEqual(mockMessage(59, 59, 1), '119m 59.000s')
		assert.strictEqual(mockMessage(0, 0, 2), '2h 0m 0.000s')
		assert.strictEqual(mockMessage(1, 0, 2), '2h 0m 1.000s')
		assert.strictEqual(mockMessage(59, 59, 23), '23h 59m 59.000s')
		assert.strictEqual(mockMessage(0, 0, 0, 1), '1d 0h 0m 0.000s')
		assert.strictEqual(mockMessage(1, 0, 0, 1), '1d 0h 0m 1.000s')
		assert.strictEqual(mockMessage(56.981, 40, 20, 2), '2d 20h 40m 56.981s')
		assert.strictEqual(mockMessage(12.345, 50, 10, 12), '12d 10h 50m 12.345s')
	})
	
	it('invalid messages', function() {
		assert.strictEqual(utils.ageOfMessage(), null)
		assert.strictEqual(utils.ageOfMessage(null), null)
		assert.strictEqual(utils.ageOfMessage({}), null)
		assert.strictEqual(utils.ageOfMessage({ timestamp: '' }), null)
	})
})

describe('utils.isPubSubSubscription', function() {
	
	it('valid object v0.11', function() {
		const sub = new EventEmitter()
		sub.parent = {}
		
		assert(utils.isPubSubSubscription(sub))
	})
	
	it('valid object v0.14', function() {
		const sub = new EventEmitter()
		sub.pubsub = {}
		
		assert(utils.isPubSubSubscription(sub))
	})
	
	describe('invalid objects', function() {
		it('primatives', function() {
			assert(!utils.isPubSubSubscription())
			assert(!utils.isPubSubSubscription(null))
			assert(!utils.isPubSubSubscription({}))
		})
		it('no pubsub property', function() {
			const sub = new EventEmitter()
			assert(!utils.isPubSubSubscription(sub))
		})
	})
})
