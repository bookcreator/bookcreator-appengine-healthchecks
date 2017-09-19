const assert = require('assert')

const SubscriptionInfo = require('../lib/SubscriptionInfo')

describe('SubscriptionInfo', function() {
	
	describe('creation', function() {
		it('has correct maxQuietPeriodMs value', function() {
			const s = new SubscriptionInfo(1000)
			assert.strictEqual(s.maxQuietPeriodMs, 1000)
		})
	})
	
	describe('check has error', function() {
		it('when not received a message', function() {
			const s = new SubscriptionInfo(1000)
			const nowDate = new Date()
			const err = s._check({ name: 'sub' }, nowDate)
			assert.throws(() => { throw err }, /^Error: Subscription sub has not received a message for never$/)
		})
		it('when received a message', function() {
			const s = new SubscriptionInfo(1000)
			s.lastMessageDate = new Date(Date.now() - 10000)
			const nowDate = new Date()
			const err = s._check({ name: 'sub' }, nowDate)
			assert.throws(() => { throw err }, /^Error: Subscription sub has not received a message for .+$/)
		})
	})
	
	describe('check has no error', function() {
		it('when received a message now', function() {
			const s = new SubscriptionInfo(1000)
			s.lastMessageDate = new Date()
			const nowDate = new Date()
			const err = s._check({ name: 'sub' }, nowDate)
			assert.strictEqual(err)
		})
		it('when received a message much less than maxQuietPeriodMs ago', function() {
			const s = new SubscriptionInfo(1000000)
			s.lastMessageDate = new Date(Date.now() - 1000)
			const nowDate = new Date()
			const err = s._check({ name: 'sub' }, nowDate)
			assert.strictEqual(err)
		})
	})
	
	describe('check boundaries', function() {
		it('when received a message at the same as maxQuietPeriodMs ago', function() {
			const s = new SubscriptionInfo(1000)
			s.lastMessageDate = new Date(Date.now() - 1000)
			const nowDate = new Date()
			const err = s._check({ name: 'sub' }, nowDate)
			assert.strictEqual(err)
		})
		it('when received a message at the same less than maxQuietPeriodMs ago', function() {
			const s = new SubscriptionInfo(1000)
			s.lastMessageDate = new Date(Date.now() - 999.999)
			const nowDate = new Date()
			const err = s._check({ name: 'sub' }, nowDate)
			assert.strictEqual(err)
		})
		it('when received a message at the same more than maxQuietPeriodMs ago', function() {
			const s = new SubscriptionInfo(1000)
			s.lastMessageDate = new Date(Date.now() - 1000.001)
			const nowDate = new Date()
			const err = s._check({ name: 'sub' }, nowDate)
			assert.throws(() => { throw err }, /^Error: Subscription sub has not received a message for .+$/)
		})
	})
})
