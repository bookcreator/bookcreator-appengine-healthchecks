const assert = require('assert')
const { EventEmitter } = require('events')
const MockDate = require('mockdate')

const SubscriptionInfo = require('../lib/SubscriptionInfo')

describe('SubscriptionInfo', function () {

	const sub = new EventEmitter()
	sub.name = 'dummy-sub'
	afterEach(function () {
		sub.removeAllListeners()
	})

	describe('creation', function () {
		it('has _sub property', function () {
			const s = new SubscriptionInfo(console, sub, 1000)
			assert.strictEqual(s._sub, sub)
		})
		it('has correct maxQuietPeriodMs value', function () {
			const s = new SubscriptionInfo(console, sub, 1000)
			assert.strictEqual(s.maxQuietPeriodMs, 1000)
			assert.ok(!s.lastMessageDate)
		})
	})

	describe('check has error', function () {

		const now = Date.now()

		before(function () {
			MockDate.set(now)
		})
		after(function () {
			MockDate.reset()
		})

		it('when not started listening', function () {
			const s = new SubscriptionInfo(console, sub, 1000)
			const nowDate = new Date()
			return s._check(nowDate).then(err => {
				assert.throws(() => { throw err }, /^Error: Not yet started listening to subscription \(dummy-sub\)$/)
			})
		})
		it('when not received a message', function () {
			const s = new SubscriptionInfo(console, sub, 1000)
			s.startListening()
			const nowDate = new Date(Date.now() + 1001)
			return s._check(nowDate).then(err => {
				assert.throws(() => { throw err }, /^Error: Subscription dummy-sub has never received a message$/)
			})
		})
		it('when received a message past the allowed time', function () {
			const s = new SubscriptionInfo(console, sub, 1000)
			s.startListening()
			s.lastMessageDate = new Date(Date.now() - 10000)
			const nowDate = new Date()
			return s._check(nowDate).then(err => {
				assert.throws(() => { throw err }, /^Error: Subscription dummy-sub has not received a message for .+$/)
			})
		})
	})

	describe('check has no error', function () {
		it('when received a message now', function () {
			const s = new SubscriptionInfo(console, sub, 1000)
			s.startListening()
			s.lastMessageDate = new Date()
			const nowDate = new Date()
			return s._check(nowDate)
		})
		it('when received a message much less than maxQuietPeriodMs ago', function () {
			const s = new SubscriptionInfo(console, sub, 1000000)
			s.startListening()
			s.lastMessageDate = new Date(Date.now() - 1000)
			const nowDate = new Date()
			return s._check(nowDate)
		})
		it('when listening but not yet received', function () {
			const s = new SubscriptionInfo(console, sub, 10000)
			s.startListening()
			const nowDate = new Date()
			return s._check(nowDate)
		})
	})

	describe('check boundaries', function () {
		it('when received a message at the same as maxQuietPeriodMs ago', function () {
			const s = new SubscriptionInfo(console, sub, 1000)
			s.startListening()
			s.lastMessageDate = new Date(Date.now() - 1000)
			const nowDate = new Date()
			return s._check(nowDate)
		})
		it('when received a message at the same less than maxQuietPeriodMs ago', function () {
			const s = new SubscriptionInfo(console, sub, 1000)
			s.startListening()
			s.lastMessageDate = new Date(Date.now() - 999.999)
			const nowDate = new Date()
			return s._check(nowDate)
		})
		it('when received a message at the same more than maxQuietPeriodMs ago', function () {
			const s = new SubscriptionInfo(console, sub, 1000)
			s.startListening()
			s.lastMessageDate = new Date(Date.now() - 1000.001)
			const nowDate = new Date()
			return s._check(nowDate).then(err => {
				assert.throws(() => { throw err }, /^Error: Subscription dummy-sub has not received a message for .+$/)
			})
		})
	})

	describe('listeners', function () {

		it('adds listeners', function (done) {
			const s = new SubscriptionInfo(console, sub, 1000)

			const initialMessageListenerCount = sub.listenerCount('message')
			const initialErrorListenerCount = sub.listenerCount('error')

			sub.on('newListener', (event, listener) => {
				assert(event === 'message' || event === 'error')
				if (event === 'message') {
					assert(listener, s.__messageListener)
				}
				if (event === 'error') {
					assert(listener, s.__errorListener)
				}
			})

			process.nextTick(() => {
				s.startListening()

				assert.strictEqual(sub.listenerCount('message'), initialMessageListenerCount + 1)
				assert.strictEqual(sub.listenerCount('error'), initialErrorListenerCount + 1)

				done()
			})
		})

		it('removes listeners', function (done) {
			const s = new SubscriptionInfo(console, sub, 1000)
			s.startListening()

			sub.on('removeListener', (event, listener) => {
				assert(event === 'message' || event === 'error')
				if (event === 'message') {
					assert(listener, s.__messageListener)
				}
				if (event === 'error') {
					assert(listener, s.__errorListener)
				}
			})

			const initialMessageListenerCount = sub.listenerCount('message')
			const initialErrorListenerCount = sub.listenerCount('error')

			process.nextTick(() => {
				s.stopListening()

				assert.strictEqual(sub.listenerCount('message'), initialMessageListenerCount - 1)
				assert.strictEqual(sub.listenerCount('error'), initialErrorListenerCount - 1)

				done()
			})
		})
	})

	describe('message listener', function () {

		const past = new Date(Date.now() - 2144214)
		const now = Date.now()

		before(function () {
			MockDate.set(now)
		})
		after(function () {
			MockDate.reset()
		})

		it('receives message', function (done) {
			const m = { timestamp: past }
			const s = new SubscriptionInfo(console, sub, 1000)
			const fn = s._messageListener
			s._messageListener = message => {
				fn.call(s, message)
				assert.strictEqual(message, m)
				done()
			}
			s.startListening()

			sub.emit('message', m)
		})

		it('receives message and sets lastMessageDate', function (done) {
			const m = { timestamp: past }
			const s = new SubscriptionInfo(console, sub, 1000)
			assert.ok(!s.lastMessageDate)
			const fn = s._messageListener
			s._messageListener = message => {
				fn.call(s, message)
				assert.strictEqual(s.lastMessageDate.getTime(), now)
				done()
			}
			s.startListening()

			sub.emit('message', m)
		})
	})

	describe('error listener', function () {

		it('receives error', function (done) {
			const err = new Error('Some error')
			const s = new SubscriptionInfo(console, sub, 1000)
			const fn = s._errorListener
			s._errorListener = errArg => {
				fn.call(s, errArg)
				assert.strictEqual(errArg, err)
				done()
			}
			s.startListening()

			sub.emit('error', err)
		})
	})

	describe('restarts', function () {

		it('should not have restart handler', function () {
			const s = new SubscriptionInfo(console, sub, 1000)
			assert.strictEqual(s.restartHandler, undefined)
		})

		it('should have restart handler', function () {
			const handler = () => { }
			const s = new SubscriptionInfo(console, sub, 1000, handler)
			assert.strictEqual(s.restartHandler, handler)
		})

		it('should not have a new sub when restart handler does nothing', function () {
			const s = new SubscriptionInfo(console, sub, 1000, (orgSub, cb) => cb(null, orgSub))
			s.startListening()
			s.lastMessageDate = new Date(Date.now() - 1000.001)

			return s._restart().then(newSub => {
				assert.strictEqual(newSub, undefined)
			})
		})

		it('should error when restart handler fails', function () {
			const restartErr = new Error('Restart error')

			const s = new SubscriptionInfo(console, sub, 1000, (orgSub, cb) => cb(restartErr))
			s.startListening()
			s.lastMessageDate = new Date(Date.now() - 1000.001)

			return s._restart().catch(err => {
				assert.deepStrictEqual(err, restartErr)
			})
		})

		it('should return new sub to one provided by restart handler', function () {

			const newSub = new EventEmitter()
			newSub.name = 'new-dummy-sub'

			const s = new SubscriptionInfo(console, sub, 1000, (orgSub, cb) => {
				return cb(null, newSub)
			})
			s.startListening()
			s.lastMessageDate = new Date(Date.now() - 1000.001)

			return s._restart().then(aSub => {
				assert.notStrictEqual(aSub, sub)
				assert.deepStrictEqual(aSub, newSub)
			})
		})
	})
})
