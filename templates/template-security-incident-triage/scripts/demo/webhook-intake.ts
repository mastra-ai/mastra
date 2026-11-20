import { createHmac, randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import type { OperationalStore } from '../../src/db/operational-store.js';
import { fixedClock } from '../../src/domain/clock.js';
import type { ServerConfig } from '../../src/env.js';
import { requestContextMiddleware, type AppEnv } from '../../src/http-context.js';
import { registerWebhookRoutes } from '../../src/app/webhooks/routes.js';
import type { IncidentKind } from '../../src/schemas/incident.js';

export const demoNow = '2026-08-28T10:00:00.000Z';
export const demoOutboxOptions = {
  batchSize: 1,
  leaseMs: 10_000,
  maxAttempts: 5,
  backoffBaseMs: 1,
  backoffCapMs: 10,
  recoveryGraceMs: 1_000,
};
export const silentDemoLogger = { write: () => {} };

/** Real route/middleware and cryptographic verification, using an in-process
 * Request rather than opening a listener or using customer credentials. */
export async function ingestLocalDemoAlert(store: OperationalStore, kind: IncidentKind) {
  const secret = randomBytes(32).toString('hex');
  const config: ServerConfig = {
    mode: 'local',
    webhooksEnabled: true,
    alertWebhookSecret: secret,
    alertWebhookSources: new Set(['security-monitor']),
    webhookMaxBodyBytes: 65_536,
    mastraMaxBodyBytes: 1_048_576,
    outbox: { ...demoOutboxOptions, pollIntervalMs: 250 },
    port: 3_000,
  };
  const app = new Hono<AppEnv>();
  let request = 0;
  app.use(
    '*',
    requestContextMiddleware(() => `demo-request-${++request}`),
  );
  registerWebhookRoutes(app, {
    config,
    store,
    logger: silentDemoLogger,
    clock: fixedClock(demoNow),
    nowMs: () => Date.parse(demoNow),
  });
  const body = JSON.stringify({
    schemaVersion: 1,
    source: 'security-monitor',
    sourceEventId: 'synthetic-demo-event',
    kind,
    occurredAt: '2026-08-27T12:00:00.000Z',
    tenantId: 'tenant-1',
    subjectId: 'subject-1',
    sessionId: 'session-1',
    actor: { id: 'actor-1', type: 'user' },
    target: { id: 'subject-1', type: 'user' },
    changes: { previousRole: 'member', nextRole: 'admin' },
    ...(kind === 'unknown_device_login' ? { deviceId: 'device-new-1' } : {}),
    ...(kind === 'disallowed_country_login' ? { ip: '198.51.100.8' } : {}),
  });
  const timestamp = String(Date.parse(demoNow));
  const signature = `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex')}`;
  const send = (signed: string) =>
    app.request('http://local-demo/webhooks/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Alert-Signature': signed,
        'X-Correlation-ID': 'correlation-1',
      },
      body,
    });
  const invalid = await send(`t=${timestamp},v1=${'0'.repeat(64)}`);
  const before = await store.execute({
    sql: 'SELECT count(*) AS count FROM incidents',
  });
  if (invalid.status !== 401 || before.rows[0]?.count !== 0) throw new Error('DEMO_SIGNATURE_GUARD_FAILED');
  const accepted = await send(signature);
  const first = z
    .object({
      accepted: z.literal(true),
      duplicate: z.literal(false),
      incidentId: z.string(),
    })
    .parse(await accepted.json());
  const duplicate = await send(signature);
  const second = z
    .object({
      accepted: z.literal(true),
      duplicate: z.literal(true),
      incidentId: z.string(),
    })
    .parse(await duplicate.json());
  if (accepted.status !== 202 || duplicate.status !== 202 || first.incidentId !== second.incidentId)
    throw new Error('DEMO_INTAKE_FAILED');
  const outbox = await store.execute({
    sql: "SELECT o.id,o.tenant_id,o.incident_id,o.correlation_id,a.id AS alert_id FROM outbox_events o JOIN alerts a ON a.incident_id=o.incident_id AND a.tenant_id=o.tenant_id WHERE o.type='security.alert.received'",
  });
  if (outbox.rows.length !== 1) throw new Error('DEMO_DUPLICATE_INTAKE_EFFECT');
  const source = outbox.rows[0]!;
  return {
    scope: {
      eventId: String(source.id),
      workflowRunId: String(source.id),
      incidentId: String(source.incident_id),
      tenantId: String(source.tenant_id),
      alertId: String(source.alert_id),
      correlationId: String(source.correlation_id),
    },
    intake: {
      invalidSignatureStatus: invalid.status,
      acceptedStatus: accepted.status,
      duplicateStatus: duplicate.status,
      duplicateIncident: second.incidentId === first.incidentId,
    },
  };
}
