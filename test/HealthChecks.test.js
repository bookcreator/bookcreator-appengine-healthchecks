const assert = require('assert')
const httpMocks = require('node-mocks-http')

const HealthChecks = require('..')

describe('HealthChecks', function() {

	const next = () => next.called = true
	beforeEach(function() {
		next.called = false
	})
	
	describe('middleware', function() {
		describe('legacy health checks', function() {
			describe('default endpoint', function() {
				it('no match', function() {
					const hc = new HealthChecks()
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/path'
					})
					const res = httpMocks.createResponse()
					
					hc(req, res, next)
					
					assert(!res._isEndCalled())
					assert(next.called)
				})
				it('match - healthy', function() {
					const hc = new HealthChecks()
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/_ah/health'
					})
					const res = httpMocks.createResponse()
					
					hc(req, res, next)
					
					assert(res._isEndCalled())
					assert.strictEqual(res.statusCode, 200)
					assert(!next.called)
				})
				it('match - not healthy, default error', function() {
					const hc = new HealthChecks()
					hc.setUnhealthy()
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/_ah/health'
					})
					const res = httpMocks.createResponse()
					
					hc(req, res, next)
					
					assert(res._isEndCalled())
					assert.strictEqual(res.statusCode, 500)
					assert.strictEqual(res._getData(), 'healthy check failed')
					assert(!next.called)
				})
				it('match - not healthy, error with code', function() {
					const err = new Error('Some error')
					err.code = 511
					
					const hc = new HealthChecks()
					hc.setUnhealthy(err)
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/_ah/health'
					})
					const res = httpMocks.createResponse()
					
					hc(req, res, next)
					
					assert(res._isEndCalled())
					assert.strictEqual(res.statusCode, 511)
					assert.strictEqual(res._getData(), err.message)
					assert(!next.called)
				})
				it('match - not healthy, error with statusCode', function() {
					const err = new Error('Some error')
					err.statusCode = 512
					
					const hc = new HealthChecks()
					hc.setUnhealthy(err)
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/_ah/health'
					})
					const res = httpMocks.createResponse()
					
					hc(req, res, next)
					
					assert(res._isEndCalled())
					assert.strictEqual(res.statusCode, 512)
					assert.strictEqual(res._getData(), err.message)
					assert(!next.called)
				})
				it('match - not healthy, verbose error with statusCode', function() {
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
					const res = httpMocks.createResponse()
					
					hc(req, res, next)
					
					assert(res._isEndCalled())
					assert.strictEqual(res.statusCode, 512)
					assert(res._isJSON())
					assert.deepEqual(JSON.parse(res._getData()), err)
					assert.strictEqual(JSON.parse(res._getData()).hiddenProperty)
					assert(!next.called)
				})
			})
		})
	})
})