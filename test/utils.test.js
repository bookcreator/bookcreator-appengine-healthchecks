const assert = require('assert')
const { EventEmitter } = require('events')
const MockDate = require('mockdate')

const utils = require('../lib/utils')

describe('utils', function () {

	describe('.ageOfMessage', function () {

		const now = Date.now()

		before(function () {
			MockDate.set(now)
		})
		after(function () {
			MockDate.reset()
		})

		it('valid messages ^2.10.0 (.publishTime)', function () {

			const mockMessage = (s = 0, m = 0, h = 0, d = 0) => {
				let ms = d * 24 * 60 * 60.0
				ms += h * 60 * 60
				ms += m * 60
				ms += s
				ms *= 1000

				const message = {
					publishTime: new Date(now - ms)
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

		describe('PreciseDate', function () {
			// eslint-disable-next-line node/no-extraneous-require
			const { PreciseDate } = require('@google-cloud/precise-date')

			let org
			// eslint-disable-next-line mocha/no-hooks-for-single-case
			beforeEach(function () {
				org = PreciseDate.now
			})
			// eslint-disable-next-line mocha/no-hooks-for-single-case
			afterEach(function () {
				PreciseDate.now = org
			})

			it('valid messages ^2.10.0 (.publishTime) - PreciseDate', function () {
				const duration = 123125.99
				const now = PreciseDate.now()
				MockDate.set(now)
				PreciseDate.now = function () { return now }
				assert.strictEqual(utils.ageOfMessage({ publishTime: new PreciseDate(now - duration) }), '123.126s')
			})
		})

		it('invalid messages', function () {
			assert.strictEqual(utils.ageOfMessage(), null)
			assert.strictEqual(utils.ageOfMessage(null), null)
			assert.strictEqual(utils.ageOfMessage({}), null)
			assert.strictEqual(utils.ageOfMessage({ timestamp: '' }), null)
		})
	})

	describe('.isPubSubSubscription', function () {

		const pubsub_package = {
			from: require('../package.json').devDependencies['@google-cloud/pubsub'],
			lib: new (require('@google-cloud/pubsub').PubSub)(),
			get version() { return this.lib.options.libVersion }
		}

		describe('versions of set pub-subs', function () {
			for (const { from, lib, version } of [pubsub_package]) {
				it(`${from} should be valid lib`, function () {
					assert(lib)
				})
				it(`${from} should have version`, function () {
					assert(version)
				})
			}
		})

		for (const { lib, version } of [pubsub_package]) {

			it(`valid object - ${version}`, function () {
				const sub = lib.subscription('sub-name')

				assert(utils.isPubSubSubscription(sub))
			})
		}

		describe('invalid objects', function () {
			it('primatives', function () {
				assert(!utils.isPubSubSubscription())
				assert(!utils.isPubSubSubscription(null))
				assert(!utils.isPubSubSubscription({}))
			})
			it('no pubsub or parent property', function () {
				const sub = new EventEmitter()
				assert(!utils.isPubSubSubscription(sub))
			})
		})
	})
})
