import { createHmac } from 'node:crypto';

import type { ServerConfig } from '../../src/env.js';

export const alertIntakeNowMs = Date.parse('2026-08-27T12:00:00.000Z');
export const alertIntakeTimestamp = String(alertIntakeNowMs);
export const alertSecret = 'alert-secret-for-intake-tests';
export const workosSecret = 'workos-secret-for-intake-tests';

export function makeServerConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    mode: 'local',
    webhooksEnabled: true,
    alertWebhookSecret: alertSecret,
    alertWebhookSources: new Set(['security-monitor']),
    webhookMaxBodyBytes: 65_536,
    mastraMaxBodyBytes: 1_048_576,
    outbox: {
      pollIntervalMs: 250,
      batchSize: 16,
      leaseMs: 10_000,
      maxAttempts: 5,
      backoffBaseMs: 500,
      backoffCapMs: 30_000,
      recoveryGraceMs: 10_000,
    },
    port: 3_000,
    ...overrides,
  };
}

export function signBody(body: string | Uint8Array, secret = alertSecret, timestamp = alertIntakeTimestamp): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.`, 'utf8').update(body).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

export function makeAlertWebhook(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    schemaVersion: 1,
    source: 'security-monitor',
    sourceEventId: 'source-event-1',
    kind: 'unauthorized_privilege_change',
    occurredAt: '2026-08-27T11:59:00.000Z',
    tenantId: 'tenant-1',
    subjectId: 'subject-1',
    actor: { id: 'actor-1', type: 'user' },
    target: { id: 'subject-1', type: 'user' },
    changes: { previousRole: 'member', nextRole: 'admin' },
    ...overrides,
  };
}
