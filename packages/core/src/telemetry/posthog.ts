import { createHash } from 'node:crypto';
import os from 'node:os';
import { PostHog } from 'posthog-node';

const POSTHOG_API_KEY = 'phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT';
const POSTHOG_HOST = 'https://us.posthog.com';

let client: PostHog | null = null;

export type EEEventName = 'ee_license_check' | 'ee_feature_used';

export function isEETelemetryEnabled(): boolean {
  return process.env['MASTRA_TELEMETRY_DISABLED'] !== '1';
}

export function hashTelemetryValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function getEETelemetryFallbackDistinctId(): string {
  return `mastra-${os.hostname()}`;
}

function getClient(): PostHog | null {
  if (!isEETelemetryEnabled()) {
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
    machine_id: os.hostname(),
    mastra_version: process.env['npm_package_version'] || 'unknown',
  };
}

export function captureEEEvent(
  event: EEEventName,
  distinctId: string | undefined,
  properties?: Record<string, unknown>,
): void {
  try {
    const posthog = getClient();
    if (!posthog) {
      return;
    }

    posthog.capture({
      distinctId: distinctId || getEETelemetryFallbackDistinctId(),
      event,
      properties: {
        ...getSystemProperties(),
        ...properties,
      },
    });
  } catch {
    // Telemetry must never affect auth or EE feature behavior.
  }
}

export function resetEETelemetryForTests(): void {
  client = null;
}
