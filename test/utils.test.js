const assert = require('assert')
const { EventEmitter } = require('events')
const MockDate = require('mockdate')

const utils = require('../lib/utils')

describe('utils.ageOfMessage', function () {

	const now = Date.now()

	before(function () {
		MockDate.set(now)
	})
	after(function () {
		MockDate.reset()
	})

	it('valid messages v0.11 (timestamp)', function () {

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

	it('valid messages ^0.18.0 (publishTime)', function () {

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

	it('invalid messages', function () {
		assert.strictEqual(utils.ageOfMessage(), null)
		assert.strictEqual(utils.ageOfMessage(null), null)
		assert.strictEqual(utils.ageOfMessage({}), null)
		assert.strictEqual(utils.ageOfMessage({ timestamp: '' }), null)
	})
})

const pubsub_package = {
	from: require('../package.json').devDependencies['@google-cloud/pubsub'], // eslint-disable-line global-require
	lib: require('@google-cloud/pubsub')(), // eslint-disable-line global-require
	get version() { return this.lib.options.libVersion }
}
const pubsub_v0_11 = {
	from: 'google-cloud',
	lib: require('google-cloud').pubsub(), // eslint-disable-line global-require
	get version() { return this.lib.userAgent.split('/')[1] }
}

describe('versions of set pub-subs', function () {
	for (const { from, lib, version } of [pubsub_package, pubsub_v0_11]) {
		it(`${from} should be valid lib`, function () {
			assert(lib)
		})
		it(`${from} should have version`, function () {
			assert(version)
		})
	}
})

describe('utils.isPubSubSubscription', function () {

	for (const { lib, version } of [pubsub_package, pubsub_v0_11]) {

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
