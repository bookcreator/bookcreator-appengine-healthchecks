const assert = require('assert')
const { EventEmitter } = require('events')
const httpMocks = require('node-mocks-http')

const HealthChecks = require('..')

const mockResOpts = {
	eventEmitter: EventEmitter
}

describe('HealthChecks', function () {

	describe('creation', function () {
		it('has basic values', function () {
			const hc1 = new HealthChecks()
			assert.strictEqual(hc1.maxSubscriptionQuietPeriodMs, 120000)
			assert.strictEqual(hc1.verboseErrorResponses, !!process.env.DEBUG)

			const hc2 = new HealthChecks({})
			assert.strictEqual(hc2.maxSubscriptionQuietPeriodMs, 120000)
			assert.strictEqual(hc2.verboseErrorResponses, !!process.env.DEBUG)
		})
		it('has different maxSubscriptionQuietPeriodMs', function () {
			const hc = new HealthChecks({ defaultMaxSubscriptionQuietPeriodMs: 1000 })
			assert.strictEqual(hc.maxSubscriptionQuietPeriodMs, 1000)
			assert.strictEqual(hc.verboseErrorResponses, !!process.env.DEBUG)
		})
		it('has different verboseErrorResponses', function () {
			const hc1 = new HealthChecks({ verboseErrorResponses: true })
			assert.strictEqual(hc1.maxSubscriptionQuietPeriodMs, 120000)
			assert.strictEqual(hc1.verboseErrorResponses, true)

			const hc2 = new HealthChecks({ verboseErrorResponses: 'truthy value' })
			assert.strictEqual(hc2.maxSubscriptionQuietPeriodMs, 120000)
			assert.strictEqual(hc2.verboseErrorResponses, true)
		})
	})

	describe('middleware', function () {

		describe('legacy health checks', function () {
			describe('default endpoint', function () {
				it('no match', function (done) {
					const hc = new HealthChecks()
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/path'
					})
					const res = httpMocks.createResponse(mockResOpts)

					hc(req, res, err => {
						assert(!res._isEndCalled())
						done(err)
					})
				})
				it('match - healthy', function (done) {
					const hc = new HealthChecks()
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/_ah/health'
					})
					const res = httpMocks.createResponse(mockResOpts)
					res.on('end', () => {
						assert(res._isEndCalled())
						assert.strictEqual(res.statusCode, 200)
						done()
					})

					hc(req, res, err => {
						assert('Next was called' + err ? `with error: ${err}` : '')
					})
				})
				it('match - not healthy, default error', function (done) {
					const hc = new HealthChecks()
					hc.setUnhealthy()
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/_ah/health'
					})
					const res = httpMocks.createResponse(mockResOpts)
					res.on('end', () => {
						assert(res._isEndCalled())
						assert.strictEqual(res.statusCode, 500)
						assert.strictEqual(res._getData(), 'healthy check failed')
						done()
					})

					hc(req, res, err => {
						assert('Next was called' + err ? `with error: ${err}` : '')
					})
				})
				it('match - not healthy, error with code', function (done) {
					const err = new Error('Some error')
					err.code = 511

					const hc = new HealthChecks()
					hc.setUnhealthy(err)
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/_ah/health'
					})
					const res = httpMocks.createResponse(mockResOpts)
					res.on('end', () => {
						assert(res._isEndCalled())
						assert.strictEqual(res.statusCode, 511)
						assert.strictEqual(res._getData(), err.message)
						done()
					})

					hc(req, res, err => {
						assert('Next was called' + err ? `with error: ${err}` : '')
					})
				})
				it('match - not healthy, error with statusCode', function (done) {
					const err = new Error('Some error')
					err.statusCode = 512

					const hc = new HealthChecks()
					hc.setUnhealthy(err)
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/_ah/health'
					})
					const res = httpMocks.createResponse(mockResOpts)
					res.on('end', () => {
						assert(res._isEndCalled())
						assert.strictEqual(res.statusCode, 512)
						assert.strictEqual(res._getData(), err.message)
						done()
					})

					hc(req, res, err => {
						assert('Next was called' + err ? `with error: ${err}` : '')
					})
				})
				it('match - not healthy, verbose error with statusCode', function (done) {
					const err = new Error('Some error')
					err.statusCode = 512
					err.visible = { complex: true }
					err.underlyingErr = new Error('Underlying error value')
					Object.defineProperty(err, 'hiddenProperty', { value: 'hidden value' })

					const hc = new HealthChecks({ verboseErrorResponses: true })
					hc.setUnhealthy(err)
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/_ah/health'
					})
					const res = httpMocks.createResponse(mockResOpts)
					res.on('end', () => {
						assert(res._isEndCalled())
						assert.strictEqual(res.statusCode, 512)
						assert(res._isJSON())
						assert.deepEqual(JSON.parse(res._getData()), Object.assign({ message: err.message, statusCode: err.statusCode }, err))
						assert.strictEqual(JSON.parse(res._getData()).hiddenProperty)
						done()
					})

					hc(req, res, err => {
						assert('Next was called' + err ? `with error: ${err}` : '')
					})
				})
			})
		})
	})
})