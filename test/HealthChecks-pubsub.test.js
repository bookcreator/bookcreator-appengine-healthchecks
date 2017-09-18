const assert = require('assert')
const { EventEmitter } = require('events')
const MockDate = require('mockdate')

const HealthChecks = require('..')

describe('index-pubsub', function() {
	
	const now = Date.now()

	before(function() {
		MockDate.set(now)
	})
	after(function() {
		MockDate.reset()
	})
	
	
	
})
