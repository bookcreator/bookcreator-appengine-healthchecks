'use strict'

const { inspect } = require('util')

module.exports = class Endpoint {
	
	constructor(name, { path = null, initialValue = null }) {
		Object.defineProperty(this, 'name', { value: name, enumerable: true })
		Object.defineProperty(this, 'path', { value: path, enumerable: true })
		
		if (initialValue === null) {
			this.setValid()
		} else {
			this.setError(initialValue)
		}
	}
	
	setValid() {
		this.error = null
	}
	
	setError(error) {
		if (error === null || error === true) throw new Error(`Not allowed to set ${this.name} with ${error} error`)
		this.error = error
	}
	
	// Returns false if not handled, a falsey value for success and Error for error.
	middleware(req) {
		if (!this.path || req.path !== this.path) return false
		if (this.error === null) return
		return this.error || new Error(`${this.name} check failed`)
	}
	
	toString() {
		return inspect(this)
	}
	
	inspect(depth, opts) {
		opts = Object.assign({}, opts, { depth: (opts.depth || 0) - 1 })
		let s = `${this.constructor.name} { `
		s += Object.keys(this)
				.map(p => `${p}: ${p === 'error' ? this[p] : inspect(this[p], opts)}`)
				.join(', ')
		s += ' }'
		return s
	}
}
