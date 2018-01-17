'use strict'

const HealthChecks = require('./lib/HealthChecks')

// Creates the legacy health check:
// 	/_ah/health
// See: https://cloud.google.com/appengine/docs/flexible/nodejs/configuring-your-app-with-app-yaml#legacy_health_checks
Object.defineProperty(HealthChecks, 'defaultLegacyCheck', { value: new HealthChecks() })

// Creates the updated health checks:
// 	/_ah/liveness
// 	/_ah/readiness
// (Note the the legacy health check is also included) 
// See: https://cloud.google.com/appengine/docs/flexible/nodejs/configuring-your-app-with-app-yaml#updated_health_checks 
Object.defineProperty(HealthChecks, 'defaultUpdatedCheck', { value: new HealthChecks({
	updatedHealthChecks: true
}) })

module.exports = HealthChecks
