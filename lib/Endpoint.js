const { inspect } = require('util')

module.exports = class Endpoint {

	/**
	 * @param {string} name
	 * @param {Object} config
	 * @param {import('../').Logger} config.logger
	 * @param {string} [config.path=null]
	 * @param {Error} [config.initialValue=null]
	 */
	constructor(name, config) {
		const { path = null, initialValue = null } = config
		/** @private @readonly */
		this._logger = config.logger
		Object.defineProperty(this, '_logger', { value: this._logger, enumerable: false })
		/** @readonly */
		this.name = name
		Object.defineProperty(this, 'name', { value: this.name, enumerable: true })
		/** @readonly */
		this.path = path
		Object.defineProperty(this, 'path', { value: this.path, enumerable: true })

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

	/**
	 * false if not handled, a falsey value for success and Error for error.
	 *
	 * @param {import('express-serve-static-core').Request} req
	 * @returns {false | undefined | Error}
	 */
	middleware(req) {
		this._logger.debug(`Checking endpoint for path: ${req.path}`, this)

		if (!this.path || req.path !== this.path) return false
		if (this.error === null) return
		return this.error || new Error(`${this.name} check failed`)
	}

	toString() {
		return inspect(this)
	}

	[inspect.custom](depth, opts) {
		opts = Object.assign({}, opts, { depth: (opts.depth || 0) - 1 })
		let s = `${this.constructor.name} { `
		s += Object.keys(this)
			.map(p => `${p}: ${p === 'error' ? this[p] : inspect(this[p], opts)}`)
			.join(', ')
		s += ' }'
		return s
	}
}
