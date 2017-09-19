const assert = require('assert')
const { EventEmitter } = require('events')
const MockDate = require('mockdate')

const SubscriptionInfo = require('../lib/SubscriptionInfo')

describe('SubscriptionInfo', function() {
		
	const sub = new EventEmitter()
	sub.name = 'dummy-sub'
	afterEach(function() {
		sub.removeAllListeners()
	})
	
	describe('creation', function() {
		it('has _sub property', function() {
			const s = new SubscriptionInfo(sub, 1000)
			assert.strictEqual(s._sub, sub)
		})
		it('has correct maxQuietPeriodMs value', function() {
			const s = new SubscriptionInfo(sub, 1000)
			assert.strictEqual(s.maxQuietPeriodMs, 1000)
			assert.ok(!s.lastMessageDate)
		})
	})
	
	describe('check has error', function() {
		it('when not received a message', function() {
			const s = new SubscriptionInfo(sub, 1000)
			const nowDate = new Date()
			const err = s._check(nowDate)
			assert.throws(() => { throw err }, /^Error: Subscription dummy-sub has not received a message for never$/)
		})
		it('when received a message', function() {
			const s = new SubscriptionInfo(sub, 1000)
			s.lastMessageDate = new Date(Date.now() - 10000)
			const nowDate = new Date()
			const err = s._check(nowDate)
			assert.throws(() => { throw err }, /^Error: Subscription dummy-sub has not received a message for .+$/)
		})
	})
	
	describe('check has no error', function() {
		it('when received a message now', function() {
			const s = new SubscriptionInfo(sub, 1000)
			s.lastMessageDate = new Date()
			const nowDate = new Date()
			const err = s._check( nowDate)
			assert.strictEqual(err)
		})
		it('when received a message much less than maxQuietPeriodMs ago', function() {
			const s = new SubscriptionInfo(sub, 1000000)
			s.lastMessageDate = new Date(Date.now() - 1000)
			const nowDate = new Date()
			const err = s._check(nowDate)
			assert.strictEqual(err)
		})
	})
	
	describe('check boundaries', function() {
		it('when received a message at the same as maxQuietPeriodMs ago', function() {
			const s = new SubscriptionInfo(sub, 1000)
			s.lastMessageDate = new Date(Date.now() - 1000)
			const nowDate = new Date()
			const err = s._check(nowDate)
			assert.strictEqual(err)
		})
		it('when received a message at the same less than maxQuietPeriodMs ago', function() {
			const s = new SubscriptionInfo(sub, 1000)
			s.lastMessageDate = new Date(Date.now() - 999.999)
			const nowDate = new Date()
			const err = s._check(nowDate)
			assert.strictEqual(err)
		})
		it('when received a message at the same more than maxQuietPeriodMs ago', function() {
			const s = new SubscriptionInfo(sub, 1000)
			s.lastMessageDate = new Date(Date.now() - 1000.001)
			const nowDate = new Date()
			const err = s._check(nowDate)
			assert.throws(() => { throw err }, /^Error: Subscription dummy-sub has not received a message for .+$/)
		})
	})
	
	describe('listeners', function() {
		
		it('adds listeners', function(done) {
			const s = new SubscriptionInfo(sub, 1000)
			
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
				s.startListening(sub)
				
				assert.strictEqual(sub.listenerCount('message'), initialMessageListenerCount + 1)
				assert.strictEqual(sub.listenerCount('error'), initialErrorListenerCount + 1)
				
				done()
			})
		})
		
		it('removes listeners', function(done) {
			const s = new SubscriptionInfo(sub, 1000)
			s.startListening(sub)
			
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
				s.stopListening(sub)
				
				assert.strictEqual(sub.listenerCount('message'), initialMessageListenerCount - 1)
				assert.strictEqual(sub.listenerCount('error'), initialErrorListenerCount - 1)
				
				done()
			})
		})
	})
	
	describe('message listener', function() {
		
		const past = new Date(Date.now() - 2144214)
		const now = Date.now()

		before(function() {
			MockDate.set(now)
		})
		after(function() {
			MockDate.reset()
		})
	
		it('receives message', function(done) {
			const m = { timestamp: past }
			const s = new SubscriptionInfo(sub, 1000)
			const fn = s._messageListener
			s._messageListener = message => {
				fn.call(s, message)
				assert.strictEqual(message, m)
				done()
			}
			const initialCount = sub
			s.startListening(sub)
			
			sub.emit('message', m)
		})
	
		it('receives message and sets lastMessageDate', function(done) {
			const m = { timestamp: past }
			const s = new SubscriptionInfo(sub, 1000)
			assert.ok(!s.lastMessageDate)
			const fn = s._messageListener
			s._messageListener = message => {
				fn.call(s, message)
				assert.strictEqual(s.lastMessageDate.getTime(), now)
				done()
			}
			s.startListening(sub)
			
			sub.emit('message', m)
		})
	})
	
	describe('error listener', function() {
		
		it('receives error', function(done) {
			const err = new Error('Some error')
			const s = new SubscriptionInfo(sub, 1000)
			const fn = s._errorListener
			s._errorListener = errArg => {
				fn.call(s, errArg)
				assert.strictEqual(errArg, err)
				done()
			}
			s.startListening(sub)
			
			sub.emit('error', err)
		})
	})
})
