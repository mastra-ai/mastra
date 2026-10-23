import { createHash } from 'node:crypto';
import os from 'node:os';
import { PostHog } from 'posthog-node';

const POSTHOG_API_KEY = 'phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT';
const POSTHOG_HOST = 'https://us.posthog.com';
const TRUTHY_DISABLED_VALUES = new Set(['1', 'true', 'yes']);

let client: PostHog | null = null;

export type EEEventName = 'ee_license_check' | 'ee_feature_used';

export type TelemetryEventName =
  | EEEventName
  | 'mastra_model_token_usage'
  | 'mastra_model_token_usage_v2'
  | 'mastra_feature_usage';

export function isTelemetryEnabled(): boolean {
  const value = process.env['MASTRA_TELEMETRY_DISABLED'];
  if (!value) {
    return true;
  }
  return !TRUTHY_DISABLED_VALUES.has(value.trim().toLowerCase());
}

export function hashTelemetryValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function getHashedHostname(): string {
  return hashTelemetryValue(os.hostname() || 'unknown-host').slice(0, 16);
}

export function getEETelemetryFallbackDistinctId(): string {
  return `mastra-${getHashedHostname()}`;
}

function getClient(): PostHog | null {
  if (!isTelemetryEnabled()) {
    return null;
  }

  if (!client) {
    client = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
      disableGeoip: false,
    });
  }

  return client;
}

function getSystemProperties(): Record<string, unknown> {
  return {
    os: process.platform,
    os_version: os.release(),
    node_version: process.version,
    platform: process.arch,
    machine_id: getHashedHostname(),
    mastra_version: process.env['npm_package_version'] || 'unknown',
  };
}

function buildMessage(event: TelemetryEventName, distinctId: string | undefined, properties?: Record<string, unknown>) {
  return {
    distinctId: distinctId || getEETelemetryFallbackDistinctId(),
    event,
    properties: {
      ...getSystemProperties(),
      ...properties,
    },
  };
}

export function captureTelemetryEvent(
  event: TelemetryEventName,
  distinctId: string | undefined,
  properties?: Record<string, unknown>,
): void {
  try {
    getClient()?.capture(buildMessage(event, distinctId, properties));
  } catch {
    // Telemetry must never affect auth or EE feature behavior.
  }
}

/**
 * Sends the event right away and resolves once the request has finished, so callers
 * can wait for delivery before the process exits. Never rejects: PostHog retries
 * failed requests internally and reports what still fails through its own error
 * channel.
 */
export async function captureTelemetryEventImmediate(
  event: TelemetryEventName,
  distinctId: string | undefined,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    await getClient()?.captureImmediate(buildMessage(event, distinctId, properties));
  } catch {
    // Telemetry must never affect server behavior.
  }
}

export function captureEEEvent(
  event: EEEventName,
  distinctId: string | undefined,
  properties?: Record<string, unknown>,
): void {
  captureTelemetryEvent(event, distinctId, properties);
}

export function resetEETelemetryForTests(): void {
  client = null;
}
