const assert = require('assert')
const { EventEmitter } = require('events')
const MockDate = require('mockdate')
const httpMocks = require('node-mocks-http')

const HealthChecks = require('..')

const mockResOpts = {
	eventEmitter: EventEmitter
}

class Subscription extends EventEmitter {

	constructor() {
		super()
		this.name = 'dummy-sub'
		this.pubsub = {}
	}
}

describe('HealthChecks - pubsub', function () {

	const now = Date.now()

	before(function () {
		MockDate.set(now)
	})
	after(function () {
		MockDate.reset()
	})

	const sub = new Subscription()
	afterEach(function () {
		sub.removeAllListeners()
	})

	describe('listeners', function () {
		it('attaches listeners', function () {
			const initialMessageListenerCount = sub.listenerCount('message')
			const initialErrorListenerCount = sub.listenerCount('error')

			const hc = new HealthChecks()
			hc.startMonitorPubSubSubscription(sub)

			assert.strictEqual(sub.listenerCount('message'), initialMessageListenerCount + 1)
			assert.strictEqual(sub.listenerCount('error'), initialErrorListenerCount + 2)
		})
		it('detaches listeners', function () {
			const initialMessageListenerCount = sub.listenerCount('message')
			const initialErrorListenerCount = sub.listenerCount('error')

			const hc = new HealthChecks()
			hc.startMonitorPubSubSubscription(sub)
			hc.stopMonitorPubSubSubscription(sub)

			assert.strictEqual(sub.listenerCount('message'), initialMessageListenerCount)
			assert.strictEqual(sub.listenerCount('error'), initialErrorListenerCount)
		})
		it('sets unhealthy on error', function () {
			const hc = new HealthChecks()
			hc.startMonitorPubSubSubscription(sub)

			assert.strictEqual(hc._healthy.error, null)

			const err = new Error('Some error')
			sub.emit('error', err)

			assert.strictEqual(hc._healthy.error, err)
		})
	})

	describe('middleware', function () {
		describe('legacy health checks', function () {
			describe('default endpoint', function () {
				it('has no error', function (done) {
					const hc = new HealthChecks()
					hc.startMonitorPubSubSubscription(sub)
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/_ah/health'
					})
					const res = httpMocks.createResponse(mockResOpts)
					res.on('end', () => {
						assert(res._isEndCalled())
						assert.strictEqual(res.statusCode, 200, `Invalid error code, response data: ${res._getData()}`)
						done()
					})

					hc(req, res, err => {
						assert('Next was called' + err ? `with error: ${err}` : '')
					})
				})
				it('has no message error', function (done) {
					const hc = new HealthChecks()
					MockDate.set(now - (2 * hc.maxSubscriptionQuietPeriodMs))
					hc.startMonitorPubSubSubscription(sub)
					MockDate.set(now)
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/_ah/health'
					})
					const res = httpMocks.createResponse(mockResOpts)
					res.on('end', () => {
						assert(res._isEndCalled())
						assert.strictEqual(res.statusCode, 500, `Invalid error code, response data: ${res._getData()}`)
						done()
					})

					hc(req, res, err => {
						assert('Next was called' + err ? `with error: ${err}` : '')
					})
				})
				it('has no message in allowed period error', function (done) {
					const hc = new HealthChecks()
					hc.startMonitorPubSubSubscription(sub)
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/_ah/health'
					})
					const res = httpMocks.createResponse(mockResOpts)
					res.on('end', () => {
						assert(res._isEndCalled())
						assert.strictEqual(res.statusCode, 500, `Invalid error code, response data: ${res._getData()}`)
						done()
					})

					// Send some messages
					sub.emit('message', { publishTime: new Date(now - 100) })
					sub.emit('message', { publishTime: new Date(now) })

					// Move forward in time and then check
					MockDate.set(now + (2 * hc.maxSubscriptionQuietPeriodMs))

					hc(req, res, err => {
						assert('Next was called' + err ? `with error: ${err}` : '')
					})
				})
				it('has no message error and then error clears', function (done) {
					const hc = new HealthChecks()
					MockDate.set(now - (2 * hc.maxSubscriptionQuietPeriodMs))
					hc.startMonitorPubSubSubscription(sub)
					MockDate.set(now)
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/_ah/health'
					})
					const res1 = httpMocks.createResponse(mockResOpts)
					const res2 = httpMocks.createResponse(mockResOpts)

					const reses = new Set([res1, res2])
					const resDone = res => {
						reses.delete(res)
						if (reses.size === 0) done()
					}

					res1.on('end', () => {
						assert(res1._isEndCalled())
						assert.strictEqual(res1.statusCode, 500, `Invalid error code, response data: ${res1._getData()}`)
						resDone(res1)
					})

					hc(req, res1, err => {
						assert('Next was called' + err ? `with error: ${err}` : '')
					})

					// Send a message
					sub.emit('message', { publishTime: new Date(now - 100) })

					res2.on('end', () => {
						assert(res2._isEndCalled())
						assert.strictEqual(res2.statusCode, 500, `Invalid error code, response data: ${res2._getData()}`)
						resDone(res2)
					})

					hc(req, res2, err => {
						assert('Next was called' + err ? `with error: ${err}` : '')
					})
				})
			})
		})
	})

	describe('restarts', function () {

		it('should do nothing when restart handler is provided and no error occurs', function (done) {
			const hc = new HealthChecks()
			hc.startMonitorPubSubSubscription(sub, (orgSub, cb) => {
				assert.deepStrictEqual(orgSub, sub)
				cb(null, orgSub)
			})

			hc._checkSubscriptions(() => {
				assert.ifError(hc._healthy.error)
				done()
			})
		})

		it('should error when no new sub is provided', function (done) {
			const hc = new HealthChecks()
			MockDate.set(now - (2 * hc.maxSubscriptionQuietPeriodMs))
			hc.startMonitorPubSubSubscription(sub, (orgSub, cb) => {
				assert.deepStrictEqual(orgSub, sub)
				cb()
			})
			MockDate.set(now)

			hc._checkSubscriptions(() => {
				assert.throws(() => { throw hc._healthy.error }, /^Error: Subscription dummy-sub has never received a message$/)
				done()
			})
		})

		it('should error when same sub is provided', function (done) {
			const hc = new HealthChecks()
			MockDate.set(now - (2 * hc.maxSubscriptionQuietPeriodMs))
			hc.startMonitorPubSubSubscription(sub, (orgSub, cb) => {
				assert.deepStrictEqual(orgSub, sub)
				cb(null, orgSub)
			})
			MockDate.set(now)

			hc._checkSubscriptions(() => {
				assert.throws(() => { throw hc._healthy.error }, /^Error: Subscription dummy-sub has never received a message$/)
				done()
			})
		})

		it('should start monitoring new sub when same sub is provided', function (done) {
			const newSub = new Subscription()

			const hc = new HealthChecks()
			MockDate.set(now - (2 * hc.maxSubscriptionQuietPeriodMs))
			hc.startMonitorPubSubSubscription(sub, (orgSub, cb) => {
				assert.deepStrictEqual(orgSub, sub)
				cb(null, newSub)
			})
			MockDate.set(now)

			const orgInfo = hc._subscriptions.get(sub)

			hc._checkSubscriptions(() => {
				assert.ifError(hc._healthy.error)
				assert.subInfoEqual(hc._subscriptions.get(newSub), orgInfo)
				done()
			})
		})
	})
})

assert.subInfoEqual = function (actual, expected, message) {
	try {
		this.deepStrictEqual(actual.maxQuietPeriodMs, expected.maxQuietPeriodMs)
		this.deepStrictEqual(actual.restartHandler, expected.restartHandler)
		this.deepStrictEqual(actual._subName, expected._subName)
		this.deepStrictEqual(actual._sub.pubsub, expected._sub.pubsub)
	} catch (ex) {
		this.fail(actual, expected, message, '!==', this.subInfoEqual)
	}
}
