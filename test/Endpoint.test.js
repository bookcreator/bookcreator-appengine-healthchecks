const assert = require('assert')
const httpMocks = require('node-mocks-http')

const Endpoint = require('../lib/Endpoint')

describe('Endpoint', function () {

	describe('creation', function () {
		it('errors with bad values', function () {
			// @ts-expect-error
			assert.throws(() => new Endpoint(), TypeError)
			// @ts-expect-error
			assert.throws(() => new Endpoint('name'), TypeError)
		})
		it('has correct basic values', function () {
			const ep = new Endpoint('name', { logger: console })
			// @ts-expect-error
			assert.strictEqual(ep._logger, console)
			assert.strictEqual(ep.name, 'name')
			assert.strictEqual(ep.path, null)
			assert.strictEqual(ep.error, null)
		})
		it('has correct path', function () {
			assert.strictEqual(new Endpoint('name', { logger: console, path: '/some/path' }).path, '/some/path')
		})
		it('has correct initial boolean value', function () {
			// @ts-expect-error
			assert.notStrictEqual(new Endpoint('name', { logger: console, initialValue: false }).error, null)
		})
		it('has correct initial value', function () {
			const err = new Error('Some error')
			assert.strictEqual(new Endpoint('name', { logger: console, initialValue: err }).error, err)
		})
	})

	describe('paths', function () {
		describe('matches request', function () {
			it('with no path', function () {
				const req = httpMocks.createRequest({
					method: 'GET',
					url: '/path'
				})
				assert.strictEqual(new Endpoint('name', { logger: console, }).middleware(req), false)
			})
			it('with path', function () {
				const req = httpMocks.createRequest({
					method: 'GET',
					url: '/path'
				})
				assert.strictEqual(new Endpoint('name', { logger: console, path: '/path' }).middleware(req), undefined)
			})
			it('with path but boolean true initial value', function () {
				const req = httpMocks.createRequest({
					method: 'GET',
					url: '/path'
				})
				assert.strictEqual(new Endpoint('name', { logger: console, path: '/path' }).middleware(req), undefined)
			})
			it('with path but boolean false initial value', function () {
				const req = httpMocks.createRequest({
					method: 'GET',
					url: '/path'
				})
				const err = new Endpoint('name', { logger: console, path: '/path', initialValue: false }).middleware(req)
				assert.throws(() => { throw err }, /^Error: name check failed$/)
			})
			it('with path but object error', function () {
				const req = httpMocks.createRequest({
					method: 'GET',
					url: '/path'
				})
				const err = new Error('Some error')
				assert.strictEqual(new Endpoint('name', { logger: console, path: '/path', initialValue: err }).middleware(req), err)
			})
		})
	})

	describe('setError', function () {
		it('errors with null', function () {
			assert.throws(() => new Endpoint('name', { logger: console, }).setError(null), /^Error: Not allowed to set name with null error$/)
		})
		it('errors with true', function () {
			assert.throws(() => new Endpoint('name', { logger: console, }).setError(true), /^Error: Not allowed to set name with true error$/)
		})
		it('it allows no value', function () {
			const ep = new Endpoint('name', { logger: console, })
			ep.setError()
			assert.notStrictEqual(ep.error, null)
			assert.strictEqual(ep.error, undefined)
		})
		it('it allows boolean false value', function () {
			const ep = new Endpoint('name', { logger: console, })
			ep.setError(false)
			assert.notStrictEqual(ep.error, null)
			assert.strictEqual(ep.error, false)
		})
		it('it allows error object', function () {
			const err = new Error('Some error')
			const ep = new Endpoint('name', { logger: console, })
			ep.setError(err)
			assert.notStrictEqual(ep.error, null)
			assert.strictEqual(ep.error, err)
		})
	})

	describe('setValid', function () {
		it('clears the error', function () {
			const err = new Error('Some error')
			const ep = new Endpoint('name', { logger: console, })
			ep.setError(err)
			assert.notStrictEqual(!ep.error, null)
			ep.setValid()
			assert.strictEqual(ep.error, null)
		})
	})
})
