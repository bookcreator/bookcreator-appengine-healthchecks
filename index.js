'use strict'

const HealthChecks = require('./lib/HealthChecks')

module.exports = {
	HealthChecks,
	defaultUpdatedCheck: new HealthChecks({ updatedHealthChecks: true }),
	defaultLegacyCheck: new HealthChecks()
}
