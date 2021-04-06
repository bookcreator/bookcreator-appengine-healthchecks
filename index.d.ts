/// <reference types="@google-cloud/pubsub" />
/// <reference types="express-serve-static-core" />

import { Subscription } from '@google-cloud/pubsub'
import { RequestHandler } from 'express-serve-static-core'

export interface EndpointConfig {
   path?: string;
   initialValue?: Error;
}

export type Logger = Record<'debug' | 'info' | 'warn' | 'error', (...args: any[]) => void>;

export interface HealthChecksConfig {
   defaultMaxSubscriptionQuietPeriodMs?: number;
   liveness?: string | EndpointConfig;
   readiness?: string | EndpointConfig;
   verboseErrorResponses?: boolean;
   logger?: Logger;
}

export type RestartHandler = (subscription: Subscription) => Promise<Subscription | null> | (Subscription | null);

export type HealthError = Error | false;

export class HealthChecks extends RequestHandler {

   readonly maxSubscriptionQuietPeriodMs: number;
   verboseErrorResponses: boolean;

   constructor(options?: HealthChecksConfig);

   setAlive(): void;
   setDead(error?: HealthError): void;

   setReady(): void;
   setUnready(error?: HealthError): void;

   startMonitorPubSubSubscription(subscription: Subscription, maxQuietPeriodMs?: number, restartHandler?: RestartHandler): void;
   stopMonitorPubSubSubscription(subscription: Subscription): void;

   readonly middleware: RequestHandler;
}

/**
 * Creates the updated health checks:
 * - /liveness_check
 *	- /readiness_check
 * *
 * @see https://cloud.google.com/appengine/docs/flexible/nodejs/reference/app-yaml#updated_health_checks
 */
export const defaultCheck: HealthChecks;
