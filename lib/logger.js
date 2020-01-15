const util = require('util')
if (process.env.DEBUG) util.inspect.defaultOptions.breakLength = 100
const { createLogger: createWinstonLogger, format, transports } = require('winston')

function makeLogger(forGAE, logName) {

	/* istanbul ignore if */
	if (forGAE) {

		// eslint-disable-next-line global-require
		const { LoggingWinston } = require('@google-cloud/logging-winston')

		/** @type {import('@google-cloud/logging-winston/build/src/types/core').Options} */
		const sdOptions = {
			handleExceptions: true,
			projectId: process.env.GCLOUD_PROJECT,
			labels: {
				instance: process.env.GAE_INSTANCE
			}
		}
		if (process.env.GAE_ENV !== 'standard') {
			// Flex has different instance names
			// aef-<service>-<version>-xcxx
			sdOptions.labels.instance = process.env.GAE_INSTANCE.replace(new RegExp(`^aef-${process.env.GAE_SERVICE.replace(/-/g, '--')}-${process.env.GAE_VERSION}-`), '')

			if (process.env.GCE_INSTANCE_GROUP) {
				sdOptions.serviceContext = {
					service: process.env.GAE_SERVICE
				}
				sdOptions.resource = {
					type: 'gae_app',
					labels: {
						module_id: process.env.GAE_SERVICE,
						project_id: process.env.GCLOUD_PROJECT,
						version_id: process.env.GAE_VERSION,
						zone: process.env.GAE_ZONE
					}
				}
				if (process.env.HOSTNAME) {
					sdOptions.labels.instance = process.env.HOSTNAME.replace(`${process.env.GCE_INSTANCE_GROUP}-`, '')
					sdOptions.resource.labels.instance_id = sdOptions.labels.instance
				}
			}
		}
		if (logName) sdOptions.logName = logName
		const production = process.env.GCLOUD_PROJECT === 'book-creator'

		return createWinstonLogger({
			level: production ? (process.env.LOG_LEVEL || 'info') : 'debug',
			format: format.combine(
				format.errors({ stack: true }),
				format(info => {
					if (!(Symbol.for('splat') in info)) return info
					const splat = info[Symbol.for('splat')]
					delete info[Symbol.for('splat')]
					let args = []
					let last = null
					if (Array.isArray(splat)) {
						args = splat.slice(0, -1)
						last = splat[splat.length - 1]
					} else {
						last = splat
					}
					if (args.length > 0) info.message += util.formatWithOptions({ depth: 10 }, '', ...args)
					if (String(last) === String({})) {
						Object.assign({}, last, info)
					} else {
						last = last !== undefined ? util.formatWithOptions({ depth: 10 }, '', last).trim() : ''
						if (last) info.message += ` ${last}`
					}
					return info
				})()
			),
			transports: [new LoggingWinston(sdOptions)]
		})
	}

	return createWinstonLogger({
		level: 'debug',
		format: format.combine(
			format.errors({ stack: true }),
			format.colorize(),
			format.timestamp(),
			format.printf(info => {
				let s = `${info.timestamp} - ${info.level}`
				const message = info.message
				if (message || Symbol.for('splat') in info) {
					s += ': '
					if (message) s += message
					if (Symbol.for('splat') in info) {
						const splat = info[Symbol.for('splat')]
						const splatM = util.formatWithOptions({
							depth: 10,
							colors: true
						}, '', ...(Array.isArray(splat) ? splat : [splat])).trim()
						if (splatM.length > 0) s += (splatM.startsWith('{') || splatM.startsWith('[') ? '\n' : ' ') + splatM
					}
				}
				return s
			})
		),
		transports: [new transports.Console({ handleExceptions: true })]
	})
}

const logName = 'npm.health-check'
const logger = makeLogger('GAE_INSTANCE' in process.env || 'GCE_INSTANCE_GROUP' in process.env, logName)

console.log(`${new Date().toISOString()} - [${logName}] Global logger level: ${logger.level}`)
logger.verbose('Logging setup')

module.exports = logger
