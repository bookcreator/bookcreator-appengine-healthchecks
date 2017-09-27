const { Logger, transports } = require('winston')
const baseOptions = {
	prettyPrint: true,
	timestamp: true,
	handleExceptions: true,
	humanReadableUnhandledException: true
}

const logger = new Logger()

if ('GAE_INSTANCE' in process.env) {
	logger.level = process.env.LOG_LEVEL || 'info'

	// eslint-disable-next-line global-require
	require('@google-cloud/logging-winston')
	
	logger.add(transports.StackdriverLogging, Object.assign({
		projectId: process.env.GCLOUD_PROJECT,
		logName: 'npm.health-check'
	}, baseOptions))
	
} else {
	// Running locally
	logger.level = 'debug'
	
	logger.add(transports.Console, Object.assign({
		colorize: 'all'
	}, baseOptions))
}

console.log(`${new Date().toISOString()} - [npm.health-check] Global logger level: ${logger.level}`)
logger.verbose('Logging setup')

module.exports = logger
