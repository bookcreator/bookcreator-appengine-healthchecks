'use strict'

const HealthChecks = require('./lib/HealthChecks')

module.exports = {
	HealthChecks,
	defaultCheck: new HealthChecks()
}
