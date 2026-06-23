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

type EETelemetryBridge = {
  captureEEEvent?: (event: EEEventName, distinctId: string | undefined, properties?: Record<string, unknown>) => void;
};

const EE_TELEMETRY_BRIDGE = Symbol.for('mastra.eeTelemetryBridge');

function getTelemetryBridge(): EETelemetryBridge | undefined {
  return (globalThis as typeof globalThis & { [EE_TELEMETRY_BRIDGE]?: EETelemetryBridge })[EE_TELEMETRY_BRIDGE];
}

export function captureEEEvent(event: EEEventName, distinctId: string | undefined, properties?: Record<string, unknown>): void {
  getTelemetryBridge()?.captureEEEvent?.(event, distinctId, properties);
}

export function resetEETelemetryForTests(): void {}
