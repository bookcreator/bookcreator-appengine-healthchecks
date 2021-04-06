const assert = require('assert')

const { HealthChecks, defaultCheck } = require('..')

describe('exports', function () {
	it('check constructor', function () {
		assert(typeof HealthChecks.constructor === 'function')
		assert(typeof (new HealthChecks) === 'function')
	})

	context('default check', function () {
		it('check default', function () {
			assert(defaultCheck instanceof HealthChecks)
			assert(new HealthChecks() instanceof HealthChecks)
		})
		it('has liveiness check', function () {
			assert.strictEqual(defaultCheck._alive.name, 'alive')
			assert.strictEqual(defaultCheck._alive.path, '/liveness_check')
			assert.strictEqual(defaultCheck._alive.error, null)
		})
		it('has readiness check', function () {
			assert.strictEqual(defaultCheck._ready.name, 'ready')
			assert.strictEqual(defaultCheck._ready.path, '/readiness_check')
			assert.strictEqual(defaultCheck._ready.error, null)
		})
	})
})
