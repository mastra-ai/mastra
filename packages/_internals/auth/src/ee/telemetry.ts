import { createHash } from 'node:crypto';
import os from 'node:os';

export type EEEventName = 'ee_license_check' | 'ee_feature_used';

export function isEETelemetryEnabled(): boolean {
  return process.env['MASTRA_TELEMETRY_DISABLED'] !== '1';
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

export function captureEEEvent(_event: EEEventName, _distinctId: string | undefined, _properties?: Record<string, unknown>): void {
  // Telemetry is emitted by @mastra/core. Internal auth keeps EE behavior independent of that dependency.
}

export function resetEETelemetryForTests(): void {}
