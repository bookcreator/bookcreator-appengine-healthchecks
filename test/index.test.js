const assert = require('assert')

const { HealthChecks, defaultLegacyCheck, defaultUpdatedCheck } = require('..')

describe('exports', function () {
	it('check constructor', function () {
		assert(typeof HealthChecks.constructor === 'function')
		assert(typeof (new HealthChecks) === 'function')
	})

	it('check default', function () {
		assertHealthCheck(defaultLegacyCheck)
		assertHealthCheck(new HealthChecks())
	})

	describe('updated check', function () {
		it('has legacy health check', function () {
			assertHealthCheck(defaultUpdatedCheck)
		})

		it('has liveiness check', function () {
			assert.strictEqual(defaultUpdatedCheck._alive.name, 'alive')
			assert.strictEqual(defaultUpdatedCheck._alive.path, '/liveness_check')
			assert.strictEqual(defaultUpdatedCheck._alive.error, null)
		})
		it('has readiness check', function () {
			assert.strictEqual(defaultUpdatedCheck._ready.name, 'ready')
			assert.strictEqual(defaultUpdatedCheck._ready.path, '/readiness_check')
			assert.strictEqual(defaultUpdatedCheck._ready.error, null)
		})
	})
})

function assertHealthCheck(obj) {
	assert(obj instanceof HealthChecks)
	assert.strictEqual(obj._healthy.name, 'healthy')
	assert.strictEqual(obj._healthy.path, '/_ah/health')
	assert.strictEqual(obj._healthy.error, null)
}
