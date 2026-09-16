import os from 'node:os';

export type EEEventName = 'ee_license_check' | 'ee_feature_used';

export function isEETelemetryEnabled(): boolean {
  return process.env['MASTRA_TELEMETRY_DISABLED'] !== '1';
}

export async function hashTelemetryValue(value: string): Promise<string> {
  return Buffer.from(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex');
}

async function getHashedHostname(): Promise<string> {
  return (await hashTelemetryValue(os.hostname() || 'unknown-host')).slice(0, 16);
}

export async function getEETelemetryFallbackDistinctId(): Promise<string> {
  return `mastra-${await getHashedHostname()}`;
}

type EETelemetryBridge = {
  captureEEEvent?: (event: EEEventName, distinctId: string | undefined, properties?: Record<string, unknown>) => void;
};

const EE_TELEMETRY_BRIDGE = Symbol.for('mastra.eeTelemetryBridge');

function getTelemetryBridge(): EETelemetryBridge | undefined {
  return (globalThis as typeof globalThis & { [EE_TELEMETRY_BRIDGE]?: EETelemetryBridge })[EE_TELEMETRY_BRIDGE];
}

export function captureEEEvent(
  event: EEEventName,
  distinctId: string | undefined,
  properties?: Record<string, unknown>,
): void {
  getTelemetryBridge()?.captureEEEvent?.(event, distinctId, properties);
}

export function resetEETelemetryForTests(): void {}
