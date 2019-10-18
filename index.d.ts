/// <reference types="@google-cloud/pubsub" />
/// <reference types="express-serve-static-core" />

import { Subscription } from '@google-cloud/pubsub'
import { RequestHandler } from 'express-serve-static-core'

export interface EndpointConfig {
   path?: string = null
   initialValue?: Error = null
}

export interface HealthChecksConfig {
   maxSubscriptionQuietPeriodMs?: number
   health?: 'string' | EndpointConfig
   liveness?: 'string' | EndpointConfig
   readiness?: 'string' | EndpointConfig
   updatedHealthChecks?: boolean
   verboseErrorResponses?: boolean
}

export type RestartHandler = (subscription: Subscription, callback: (err?: Error, newSubscription?: Subscription) => void) => void

export type HealthError = Error | false

export class HealthChecks extends Function {

   readonly maxSubscriptionQuietPeriodMs: number
   verboseErrorResponses: boolean

   constructor(options?: HealthChecksConfig)

   setHealthy(): void
   setUnhealthy(error?: HealthError): void

   setAlive(): void
   setDead(error?: HealthError): void

   setReady(): void
   setUnready(error?: HealthError): void

   startMonitorPubSubSubscription(subscription: Subscription, maxQuietPeriodMs?: number, restartHandler?: RestartHandler): void
   stopMonitorPubSubSubscription(subscription: Subscription): void

   readonly middleware: RequestHandler
}

/**
 * Creates the updated health checks:
 * - /liveness_check
 *	- /readiness_check
 *
 * (Note the the legacy health check is also included)
 *
 * @see https://cloud.google.com/appengine/docs/flexible/nodejs/configuring-your-app-with-app-yaml#updated_health_checks
 */
export const defaultUpdatedCheck: HealthChecks

/**
 * Creates the updated health checks:
 * - /_ah/health
 *	- /readiness_check
 *
 * @see https://cloud.google.com/appengine/docs/flexible/nodejs/configuring-your-app-with-app-yaml#legacy_health_checks
 */
export const defaultLegacyCheck: HealthChecks