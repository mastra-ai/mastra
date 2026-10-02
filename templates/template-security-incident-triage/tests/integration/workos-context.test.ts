import { createHmac } from 'node:crypto';

import { Mastra } from '@mastra/core/mastra';
import { afterEach, describe, expect, it } from 'vitest';

import { createIncidentFromAlert, createIncidentFromAlertResult } from '../../src/db/incident-operations.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { materializeInvestigationStart } from '../../src/db/workflow-run-operations.js';
import { loadInvestigationContext } from '../../src/mastra/steps/load-investigation-context.js';
import { testWorkflow } from '../helpers/test-workflow.js';
import { securityIncidentWorkflow } from '../../src/mastra/workflows/security-incident-workflow.js';
import { createApp } from '../../src/server.js';
import { evaluateSeverityPolicy } from '../../src/triage/policy.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { readIntegrationConfig } from '../../src/env.js';
import { persistEvidenceItems } from '../../src/evidence/persistence.js';
import {
  persistWorkosSnapshotBeforeIncident,
  reserveWorkosObservedState,
} from '../../src/db/workos-webhook-operations.js';
import { stageUnauthorizedPrivilegeChange } from '../../src/db/staging-privilege-intent-operations.js';
import { armExpectedWorkosMembershipCallback } from '../../src/db/workos-expected-callback-operations.js';
import { makeAlert } from '../fixtures/domain.js';
import { makeServerConfig, alertIntakeNowMs } from '../fixtures/alert-intake.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';
import { stagingIpinfoEnvironment } from '../fixtures/integrations.js';

const databases: TempDatabase[] = [];
const testMastra = new Mastra({
  workflows: {
    testWorkflow,
    securityIncidentWorkflow: securityIncidentWorkflow,
  },
});

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

function sign(bytes: Uint8Array, secret: string, timestamp = String(alertIntakeNowMs)) {
  return `t=${timestamp},v1=${createHmac('sha256', secret)
    .update(`${timestamp}.`, 'utf8')
    .update(bytes)
    .digest('hex')}`;
}

const realWorkosConfig = () =>
  readIntegrationConfig({
    RUNTIME_MODE: 'staging',
    ...stagingIpinfoEnvironment,
    WEBHOOKS_ENABLED: 'true',
    WORKOS_PROVIDER_ENABLED: 'true',
    WORKOS_API_KEY: 'fake-workos-api-key',
    WORKOS_WEBHOOK_SECRET: 'current-workos-webhook-secret',
    WORKOS_WEBHOOK_PREVIOUS_SECRET: 'previous-workos-webhook-secret',
    WORKOS_ORGANIZATION_ID: 'tenant-1',
    WORKOS_ALLOWED_ROLE_SLUGS: 'member,admin,viewer',
  });

describe('integration WorkOS raw webhook and InvestigationContext v2', () => {
  it('consumes the exact approved role-restore callback without creating another incident', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    const originalAlert = makeAlert({
      alertId: 'workos-original-role-change',
      source: 'workos',
      sourceEventId: 'workos-original-role-event',
      idempotencyKey: 'workos-original-role-delivery',
      occurredAt: '2026-08-27T12:00:00.000Z',
      changes: {
        membershipId: 'membership-1',
        workosEventType: 'organization_membership.updated',
        observedCurrentRole: 'admin',
        observedStatus: 'active',
      },
    });
    const original = await createIncidentFromAlertResult(store, originalAlert, {
      enforceAlertOrdering: true,
      preflightAlert: reserveWorkosObservedState,
      ids: sequenceIdGenerator(['incident-original', 'timeline-original', 'outbox-original']),
    });
    await store.execute({
      sql: `INSERT INTO provider_effect_ledger(
        provider, idempotency_key, tenant_id, incident_id, operation, plan_id,
        action_id, target_id, status, fence_token, claimed_at
      ) VALUES ('workos', 'effect-role-restore', 'tenant-1', 'incident-original',
        'restore_previous_role', 'plan-1', 'action-1', 'subject-1', 'claimed',
        'fence-1', '2026-08-27T12:02:00.000Z')`,
    });
    await armExpectedWorkosMembershipCallback(store, {
      effect: {
        provider: 'workos',
        idempotencyKey: 'effect-role-restore',
        tenantId: 'tenant-1',
        incidentId: 'incident-original',
        approvalId: 'approval-1',
        subjectId: 'subject-1',
        planId: 'plan-1',
        actionId: 'action-1',
        targetId: 'subject-1',
        fenceToken: 'fence-1',
        operation: 'restore_previous_role',
        now: '2026-08-27T12:02:00.000Z',
      },
      membershipId: 'membership-1',
      expectedPreviousRole: 'admin',
      expectedRole: 'member',
    });
    const callback = makeAlert({
      alertId: 'workos-role-restore-callback',
      source: 'workos',
      sourceEventId: 'workos-role-restore-event',
      idempotencyKey: 'workos-role-restore-delivery',
      occurredAt: '2026-08-27T12:02:01.000Z',
      changes: {
        membershipId: 'membership-1',
        workosEventType: 'organization_membership.updated',
        observedCurrentRole: 'member',
        observedStatus: 'active',
      },
    });
    await expect(
      createIncidentFromAlertResult(store, callback, {
        enforceAlertOrdering: true,
        preflightAlert: reserveWorkosObservedState,
      }),
    ).resolves.toMatchObject({
      duplicate: true,
      incident: { incidentId: original.incident.incidentId },
    });
    await expect(
      store.execute({
        sql: `SELECT
          (SELECT count(*) FROM incidents) AS incidents,
          (SELECT count(*) FROM alerts) AS alerts,
          (SELECT count(*) FROM outbox_events) AS outbox,
          (SELECT count(*) FROM timeline_events
            WHERE type = 'provider.effect.callback_observed') AS callback_events,
          (SELECT status FROM workos_expected_membership_callbacks) AS callback_status,
          (SELECT source_event_id FROM workos_expected_membership_callbacks) AS callback_source,
          (SELECT observed_role FROM workos_observed_memberships) AS observed_role`,
      }),
    ).resolves.toMatchObject({
      rows: [
        {
          incidents: 1,
          alerts: 1,
          outbox: 1,
          callback_events: 1,
          callback_status: 'consumed',
          callback_source: 'workos-role-restore-event',
          observed_role: 'member',
        },
      ],
    });

    const later = makeAlert({
      alertId: 'workos-later-role-change',
      source: 'workos',
      sourceEventId: 'workos-later-role-event',
      idempotencyKey: 'workos-later-role-delivery',
      occurredAt: '2026-08-27T12:03:00.000Z',
      changes: {
        membershipId: 'membership-1',
        workosEventType: 'organization_membership.updated',
        observedCurrentRole: 'admin',
        observedStatus: 'active',
      },
    });
    await expect(
      createIncidentFromAlertResult(store, later, {
        enforceAlertOrdering: true,
        preflightAlert: reserveWorkosObservedState,
      }),
    ).resolves.toMatchObject({ duplicate: false });
    await expect(
      createIncidentFromAlertResult(store, callback, {
        enforceAlertOrdering: true,
        preflightAlert: reserveWorkosObservedState,
      }),
    ).resolves.toMatchObject({
      duplicate: true,
      incident: { incidentId: original.incident.incidentId },
    });
    await expect(
      store.execute({
        sql: `SELECT count(*) AS count FROM timeline_events
          WHERE type = 'provider.effect.callback_observed'`,
      }),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
    store.close();
  });

  it('does not suppress a mismatched or expired WorkOS role callback', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    await createIncidentFromAlertResult(
      store,
      makeAlert({
        alertId: 'role-origin',
        source: 'workos',
        sourceEventId: 'role-origin-event',
        idempotencyKey: 'role-origin-delivery',
        occurredAt: '2026-08-27T12:00:00.000Z',
        changes: {
          membershipId: 'membership-1',
          workosEventType: 'organization_membership.updated',
          observedCurrentRole: 'admin',
          observedStatus: 'active',
        },
      }),
      {
        preflightAlert: reserveWorkosObservedState,
        ids: sequenceIdGenerator(['incident-origin', 'timeline-origin', 'outbox-origin']),
      },
    );
    await store.execute({
      sql: `INSERT INTO provider_effect_ledger(
        provider, idempotency_key, tenant_id, incident_id, operation, plan_id,
        action_id, target_id, status, fence_token, claimed_at
      ) VALUES ('workos', 'effect-mismatch', 'tenant-1', 'incident-origin',
        'restore_previous_role', 'plan-1', 'action-1', 'subject-1', 'claimed',
        'fence-1', '2026-08-27T12:01:00.000Z')`,
    });
    await armExpectedWorkosMembershipCallback(store, {
      effect: {
        provider: 'workos',
        idempotencyKey: 'effect-mismatch',
        tenantId: 'tenant-1',
        incidentId: 'incident-origin',
        approvalId: 'approval-1',
        subjectId: 'subject-1',
        planId: 'plan-1',
        actionId: 'action-1',
        targetId: 'subject-1',
        fenceToken: 'fence-1',
        operation: 'restore_previous_role',
        now: '2026-08-27T12:01:00.000Z',
      },
      membershipId: 'membership-1',
      expectedPreviousRole: 'admin',
      expectedRole: 'member',
    });
    await expect(
      createIncidentFromAlertResult(
        store,
        makeAlert({
          alertId: 'role-mismatch',
          source: 'workos',
          sourceEventId: 'role-mismatch-event',
          idempotencyKey: 'role-mismatch-delivery',
          occurredAt: '2026-08-27T12:02:00.000Z',
          changes: {
            membershipId: 'membership-1',
            workosEventType: 'organization_membership.updated',
            observedCurrentRole: 'viewer',
            observedStatus: 'active',
          },
        }),
        { preflightAlert: reserveWorkosObservedState },
      ),
    ).resolves.toMatchObject({ duplicate: false });
    await expect(
      store.execute({
        sql: `SELECT status FROM workos_expected_membership_callbacks
          WHERE idempotency_key = 'effect-mismatch'`,
      }),
    ).resolves.toMatchObject({ rows: [{ status: 'armed' }] });
    await expect(
      createIncidentFromAlertResult(
        store,
        makeAlert({
          alertId: 'role-expired',
          source: 'workos',
          sourceEventId: 'role-expired-event',
          idempotencyKey: 'role-expired-delivery',
          occurredAt: '2026-08-27T12:17:00.000Z',
          changes: {
            membershipId: 'membership-1',
            workosEventType: 'organization_membership.updated',
            observedCurrentRole: 'member',
            observedStatus: 'active',
          },
        }),
        { preflightAlert: reserveWorkosObservedState },
      ),
    ).resolves.toMatchObject({ duplicate: false });
    await expect(
      store.execute({
        sql: `SELECT
          (SELECT count(*) FROM incidents) AS incidents,
          (SELECT status FROM workos_expected_membership_callbacks
            WHERE idempotency_key = 'effect-mismatch') AS callback_status`,
      }),
    ).resolves.toMatchObject({
      rows: [{ incidents: 3, callback_status: 'expired' }],
    });
    store.close();
  });

  it('scopes event dedupe to provider source while preserving WorkOS replay idempotency', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    const workos = makeAlert({
      alertId: 'workos-shared-event',
      source: 'workos',
      sourceEventId: 'shared-source-event',
      tenantId: 'tenant-workos',
      idempotencyKey: 'workos-shared-delivery',
    });
    const otherSource = makeAlert({
      alertId: 'other-shared-event',
      source: 'other-provider',
      sourceEventId: 'shared-source-event',
      tenantId: 'tenant-other',
      idempotencyKey: 'other-shared-delivery',
    });
    await expect(
      createIncidentFromAlertResult(store, workos, {
        enforceAlertOrdering: true,
      }),
    ).resolves.toMatchObject({ duplicate: false });
    await expect(
      createIncidentFromAlertResult(store, otherSource, {
        enforceAlertOrdering: true,
      }),
    ).resolves.toMatchObject({ duplicate: false });
    await expect(
      createIncidentFromAlertResult(store, workos, {
        enforceAlertOrdering: true,
      }),
    ).resolves.toMatchObject({ duplicate: true });
    await expect(
      store.execute({
        sql: `SELECT source, tenant_id FROM alerts
          WHERE source_event_id = 'shared-source-event' ORDER BY source`,
      }),
    ).resolves.toMatchObject({
      rows: [
        { source: 'other-provider', tenant_id: 'tenant-other' },
        { source: 'workos', tenant_id: 'tenant-workos' },
      ],
    });
    store.close();
  });

  it('dead-letters allowlist mismatches terminally without creating incidents or logging IDs', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    const logs: unknown[] = [];
    const app = await createApp({
      config: makeServerConfig(),
      integrationConfig: {
        ...realWorkosConfig(),
        workos: {
          ...realWorkosConfig().workos,
          allowedUserIds: new Set(['subject-1']),
        },
      },
      store,
      logger: { write: entry => logs.push(entry) },
      nowMs: () => alertIntakeNowMs,
      mastraInstance: testMastra,
    });
    const send = async (
      id: string,
      overrides: Readonly<{
        organizationId?: string;
        userId?: string;
        roleSlug?: string;
      }>,
    ) => {
      const body = new TextEncoder().encode(
        JSON.stringify({
          id,
          event: 'organization_membership.updated',
          created_at: '2026-08-27T12:00:00.000Z',
          data: {
            object: 'organization_membership',
            id: 'membership-rejected',
            organization_id: overrides.organizationId ?? 'tenant-1',
            user_id: overrides.userId ?? 'subject-1',
            status: 'active',
            created_at: '2026-08-27T11:00:00.000Z',
            updated_at: '2026-08-27T12:00:00.000Z',
            role: { slug: overrides.roleSlug ?? 'member' },
          },
        }),
      );
      return app.request('/webhooks/workos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'WorkOS-Signature': sign(body, 'current-workos-webhook-secret'),
        },
        body,
      });
    };
    for (const [id, overrides] of [
      ['rejected-org', { organizationId: 'other-organization' }],
      ['rejected-user', { userId: 'other-user' }],
      ['rejected-role', { roleSlug: 'operator' }],
    ] as const) {
      const response = await send(id, overrides);
      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toMatchObject({
        accepted: false,
        disposition: 'dead_lettered',
        reasonCode: 'WORKOS_ALLOWLIST_REJECTED',
      });
    }
    await expect(
      store.execute({
        sql: `SELECT error_code FROM dead_letter_events
          WHERE error_code = 'WORKOS_ALLOWLIST_REJECTED' ORDER BY id`,
      }),
    ).resolves.toMatchObject({
      rows: [
        { error_code: 'WORKOS_ALLOWLIST_REJECTED' },
        { error_code: 'WORKOS_ALLOWLIST_REJECTED' },
        { error_code: 'WORKOS_ALLOWLIST_REJECTED' },
      ],
    });
    await expect(
      store.execute({
        sql: `SELECT
          (SELECT count(*) FROM incidents) AS incidents,
          (SELECT count(*) FROM outbox_events) AS outbox`,
      }),
    ).resolves.toMatchObject({ rows: [{ incidents: 0, outbox: 0 }] });
    expect(JSON.stringify(logs)).not.toContain('other-organization');
    expect(JSON.stringify(logs)).not.toContain('other-user');
    store.close();
  });

  it('seeds the first official observation and atomically forms the next member→admin transition', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    const app = await createApp({
      config: makeServerConfig(),
      integrationConfig: realWorkosConfig(),
      store,
      logger: { write: () => {} },
      nowMs: () => alertIntakeNowMs,
      mastraInstance: testMastra,
    });
    const body = new TextEncoder().encode(
      `{ "id":"evt-1", "event":"organization_membership.updated", "created_at":"2026-08-27T12:00:00.000Z", "data": { "object":"organization_membership", "id":"membership-1", "organization_id":"tenant-1", "organization_name":"Synthetic", "user_id":"subject-1", "status":"active", "directory_managed":false, "created_at":"2026-08-27T11:00:00.000Z", "updated_at":"2026-08-27T11:59:00.000Z", "custom_attributes":{}, "role":{"slug":"admin"} } }`,
    );
    const response = await app.request('/webhooks/workos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Multiple v1 values cover current+previous rotation without changing
        // the signed bytes. The verifier must not parse/re-serialize first.
        'WorkOS-Signature': `${sign(body, 'current-workos-webhook-secret')},v1=${sign(body, 'previous-workos-webhook-secret').split('v1=')[1]}`,
      },
      body,
    });
    expect(response.status).toBe(202);
    expect(await store.execute({ sql: 'SELECT count(*) AS n FROM incidents' })).toMatchObject({ rows: [{ n: 1 }] });
    await expect(store.execute({ sql: 'SELECT count(*) AS n FROM identity_snapshots' })).resolves.toMatchObject({
      rows: [{ n: 0 }],
    });
    await expect(
      store.execute({
        sql: 'SELECT observed_role, version FROM workos_observed_memberships',
      }),
    ).resolves.toMatchObject({
      rows: [{ observed_role: 'admin', version: 1 }],
    });
    await expect(store.execute({ sql: 'SELECT count(*) AS n FROM timeline_events' })).resolves.toMatchObject({
      rows: [{ n: 1 }],
    });
    await expect(store.execute({ sql: 'SELECT count(*) AS n FROM outbox_events' })).resolves.toMatchObject({
      rows: [{ n: 1 }],
    });
    store.close();
  });

  it('binds a staging trigger intent to the first real WorkOS privilege event', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    await stageUnauthorizedPrivilegeChange(
      store,
      {
        tenantId: 'tenant-1',
        subjectId: 'subject-1',
        membershipId: 'membership-1',
        actorId: 'staging-trigger',
        previousRole: 'member',
        currentRole: 'admin',
      },
      {
        now: () => new Date('2026-08-27T11:59:00.000Z'),
        createId: () => 'intent-1',
      },
    );
    const alert = makeAlert({
      alertId: 'alert-staging-intent',
      source: 'workos',
      sourceEventId: 'event-staging-intent',
      occurredAt: '2026-08-27T12:00:00.000Z',
      tenantId: 'tenant-1',
      subjectId: 'subject-1',
      actor: { id: 'workos:unknown:event-staging-intent', type: 'unknown' },
      target: { id: 'membership-1', type: 'membership' },
      idempotencyKey: 'idempotency-staging-intent',
      changes: {
        membershipId: 'membership-1',
        workosEventType: 'organization_membership.updated',
        observedCurrentRole: 'admin',
        observedStatus: 'active',
      },
    });
    const created = await createIncidentFromAlertResult(store, alert, {
      preflightAlert: reserveWorkosObservedState,
      beforeIncidentWrite: persistWorkosSnapshotBeforeIncident,
    });
    const persisted = await store.execute({
      sql: 'SELECT canonical_json FROM alerts WHERE source_event_id = ?',
      args: [alert.sourceEventId],
    });
    expect(JSON.parse(String(persisted.rows[0]?.canonical_json))).toMatchObject({
      actor: { id: 'staging-trigger', type: 'service' },
      changes: {
        contextVersion: 2,
        previousRole: 'member',
        nextRole: 'admin',
      },
    });
    await expect(
      createIncidentFromAlertResult(store, alert, {
        preflightAlert: reserveWorkosObservedState,
        beforeIncidentWrite: persistWorkosSnapshotBeforeIncident,
      }),
    ).resolves.toMatchObject({ duplicate: true });
    await expect(
      store.execute({
        sql: `SELECT status, source_event_id
          FROM staging_privilege_change_intents WHERE id = 'intent-1'`,
      }),
    ).resolves.toMatchObject({
      rows: [{ status: 'consumed', source_event_id: 'event-staging-intent' }],
    });
    await expect(
      store.execute({
        sql: `SELECT actor_id, previous_role, current_role, approved
          FROM identity_role_change_authorizations
          WHERE source_event_id = 'event-staging-intent'`,
      }),
    ).resolves.toMatchObject({
      rows: [
        {
          actor_id: 'staging-trigger',
          previous_role: 'member',
          current_role: 'admin',
          approved: 0,
        },
      ],
    });
    await materializeInvestigationStart(store, {
      eventId: 'workflow-staging-intent',
      incidentId: created.incident.incidentId,
      tenantId: created.incident.tenantId,
      alertId: alert.alertId,
      correlationId: 'correlation-staging-intent',
    });
    await expect(
      loadInvestigationContext(store, {
        eventId: 'workflow-staging-intent',
        incidentId: created.incident.incidentId,
        tenantId: created.incident.tenantId,
        alertId: alert.alertId,
        correlationId: 'correlation-staging-intent',
        runId: 'workflow-staging-intent',
        duplicate: false,
      }),
    ).resolves.toMatchObject({
      schemaVersion: 2,
      actorId: 'staging-trigger',
      roleChange: { previousRole: 'member', currentRole: 'admin' },
      changeApproved: false,
    });
    store.close();
  });

  it('uses the prior official observed role for the next event without inventing actor or approval', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    const app = await createApp({
      config: makeServerConfig(),
      integrationConfig: realWorkosConfig(),
      store,
      logger: { write: () => {} },
      nowMs: () => alertIntakeNowMs,
      mastraInstance: testMastra,
    });
    const send = async (id: string, role: 'member' | 'admin', updatedAt: string) => {
      const body = new TextEncoder().encode(
        JSON.stringify({
          id,
          event: 'organization_membership.updated',
          created_at: updatedAt,
          data: {
            object: 'organization_membership',
            id: 'membership-1',
            organization_id: 'tenant-1',
            organization_name: 'Synthetic',
            user_id: 'subject-1',
            status: 'active',
            directory_managed: false,
            created_at: '2026-08-27T11:00:00.000Z',
            updated_at: updatedAt,
            custom_attributes: {},
            role: { slug: role },
          },
        }),
      );
      return app.request('/webhooks/workos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'WorkOS-Signature': sign(body, 'current-workos-webhook-secret'),
        },
        body,
      });
    };
    expect((await send('evt-member', 'member', '2026-08-27T12:00:00.000Z')).status).toBe(202);
    expect((await send('evt-admin', 'admin', '2026-08-27T12:01:00.000Z')).status).toBe(202);
    await expect(store.execute({ sql: 'SELECT snapshot_json FROM identity_snapshots' })).resolves.toMatchObject({
      rows: [
        {
          snapshot_json:
            '{"membershipId":"membership-1","previousRole":"member","currentRole":"admin","observedCurrentRole":"admin"}',
        },
      ],
    });
    await expect(
      store.execute({
        sql: 'SELECT observed_role, version FROM workos_observed_memberships',
      }),
    ).resolves.toMatchObject({
      rows: [{ observed_role: 'admin', version: 2 }],
    });
    const second = await store.execute({
      sql: "SELECT canonical_json FROM alerts WHERE source_event_id = 'evt-admin'",
    });
    expect(second.rows[0]?.canonical_json).toContain('"contextVersion":2');
    expect(second.rows[0]?.canonical_json).toContain('"previousRole":"member"');
    expect(second.rows[0]?.canonical_json).toContain('"actor":{"id":"workos:unknown:evt-admin","type":"unknown"}');
    // A duplicate has no second snapshot/baseline advancement; a re-ordered
    // valid event remains rejected before it can change observed state.
    expect((await send('evt-admin', 'admin', '2026-08-27T12:01:00.000Z')).status).toBe(202);
    expect((await send('evt-reordered', 'member', '2026-08-27T12:00:30.000Z')).status).toBe(202);
    await expect(store.execute({ sql: 'SELECT count(*) AS n FROM identity_snapshots' })).resolves.toMatchObject({
      rows: [{ n: 1 }],
    });
    store.close();
  });

  it('converges equal WorkOS ordering positions and audits a contradictory role/status', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    const app = await createApp({
      config: makeServerConfig(),
      integrationConfig: realWorkosConfig(),
      store,
      logger: { write: () => {} },
      nowMs: () => alertIntakeNowMs,
      mastraInstance: testMastra,
    });
    const send = async (id: string, role: 'member' | 'admin', status: 'active' | 'inactive' = 'active') => {
      const body = new TextEncoder().encode(
        JSON.stringify({
          id,
          event: 'organization_membership.updated',
          created_at: '2026-08-27T12:00:00.000Z',
          data: {
            object: 'organization_membership',
            id: 'membership-tie',
            organization_id: 'tenant-1',
            user_id: 'subject-1',
            status,
            created_at: '2026-08-27T11:00:00.000Z',
            updated_at: '2026-08-27T12:00:00.000Z',
            role: { slug: role },
          },
        }),
      );
      return app.request('/webhooks/workos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'WorkOS-Signature': sign(body, 'current-workos-webhook-secret'),
        },
        body,
      });
    };
    const first = await send('tie-member-1', 'member');
    expect(first.status).toBe(202);
    await expect(first.json()).resolves.toMatchObject({ duplicate: false });
    const duplicate = await send('tie-member-2', 'member');
    expect(duplicate.status).toBe(202);
    await expect(duplicate.json()).resolves.toMatchObject({ duplicate: true });
    await expect(
      store.execute({
        sql: `SELECT
          (SELECT count(*) FROM incidents) AS incidents,
          (SELECT count(*) FROM alerts) AS alerts,
          (SELECT count(*) FROM timeline_events) AS timeline,
          (SELECT count(*) FROM outbox_events) AS outbox`,
      }),
    ).resolves.toMatchObject({
      rows: [{ incidents: 1, alerts: 1, timeline: 1, outbox: 1 }],
    });
    await expect(send('tie-admin', 'admin')).resolves.toMatchObject({
      status: 409,
    });
    await expect(
      store.execute({
        sql: `SELECT observed_role, observed_status, version FROM workos_observed_memberships
        WHERE membership_id = 'membership-tie'`,
      }),
    ).resolves.toMatchObject({
      rows: [{ observed_role: 'member', observed_status: 'active', version: 1 }],
    });
    await expect(
      store.execute({
        sql: `SELECT error_code FROM dead_letter_events WHERE event_ref LIKE 'sha256:%'`,
      }),
    ).resolves.toMatchObject({
      rows: expect.arrayContaining([{ error_code: 'EVENT_STATE_CONFLICT' }]),
    });
    store.close();
  });

  it('includes the allowlisted session event type in same-position canonical ordering', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    const app = await createApp({
      config: makeServerConfig(),
      integrationConfig: realWorkosConfig(),
      store,
      logger: { write: () => {} },
      nowMs: () => alertIntakeNowMs,
      mastraInstance: testMastra,
    });
    const sendSession = async (
      id: string,
      ip: string,
      sessionId = 'session-tie',
      event: 'session.created' | 'session.revoked' = 'session.created',
    ) => {
      const body = new TextEncoder().encode(
        JSON.stringify({
          id,
          event,
          created_at: '2026-08-27T12:00:00.000Z',
          data: {
            object: 'session',
            id: sessionId,
            organization_id: 'tenant-1',
            user_id: 'subject-1',
            status: 'active',
            ip_address: ip,
            created_at: '2026-08-27T12:00:00.000Z',
            updated_at: '2026-08-27T12:00:00.000Z',
          },
        }),
      );
      return app.request('/webhooks/workos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'WorkOS-Signature': sign(body, 'current-workos-webhook-secret'),
        },
        body,
      });
    };
    expect((await sendSession('session-a', '8.8.8.8')).status).toBe(202);
    // Same normalized session state but a different allowlisted lifecycle
    // event is contradictory, never an idempotent retry.
    const eventTypeConflict = await sendSession(
      'session-revoked-same-state',
      '8.8.8.8',
      'session-tie',
      'session.revoked',
    );
    expect(eventTypeConflict.status).toBe(409);
    await expect(eventTypeConflict.json()).resolves.toMatchObject({
      code: 'ALERT_CONFLICT',
    });
    await expect(
      store.execute({
        sql: `SELECT
          (SELECT count(*) FROM incidents) AS incidents,
          (SELECT count(*) FROM alerts) AS alerts,
          (SELECT count(*) FROM timeline_events) AS timeline,
          (SELECT count(*) FROM outbox_events) AS outbox,
          (SELECT count(*) FROM dead_letter_events
            WHERE error_code = 'EVENT_STATE_CONFLICT') AS conflicts`,
      }),
    ).resolves.toMatchObject({
      rows: [{ incidents: 1, alerts: 1, timeline: 1, outbox: 1, conflicts: 1 }],
    });
    // A different delivery ID with exactly the same provider event and
    // normalized state still converges to the first incident.
    const exactDuplicate = await sendSession('session-created-duplicate', '8.8.8.8');
    expect(exactDuplicate.status).toBe(202);
    await expect(exactDuplicate.json()).resolves.toMatchObject({
      duplicate: true,
    });
    const conflicting = await sendSession('session-b', '1.1.1.1');
    expect(conflicting.status).toBe(409);
    await expect(conflicting.json()).resolves.toMatchObject({
      code: 'ALERT_CONFLICT',
    });
    await expect(
      store.execute({
        sql: `SELECT count(*) AS incidents FROM incidents`,
      }),
    ).resolves.toMatchObject({ rows: [{ incidents: 1 }] });

    const concurrent = await Promise.all([
      sendSession('session-concurrent-a', '9.9.9.9', 'session-concurrent'),
      sendSession('session-concurrent-b', '9.9.9.9', 'session-concurrent'),
    ]);
    expect(concurrent.map(response => response.status)).toEqual([202, 202]);
    expect(
      (await Promise.all(concurrent.map(response => response.json())))
        .map(body => (body as { duplicate: boolean }).duplicate)
        .sort(),
    ).toEqual([false, true]);
    await expect(
      store.execute({
        sql: `SELECT count(*) AS alerts FROM alerts WHERE source_event_id LIKE 'session-concurrent-%'`,
      }),
    ).resolves.toMatchObject({ rows: [{ alerts: 1 }] });
    await expect(
      store.execute({
        sql: `SELECT error_code FROM dead_letter_events WHERE error_code = 'EVENT_STATE_CONFLICT'`,
      }),
    ).resolves.toMatchObject({
      rows: [{ error_code: 'EVENT_STATE_CONFLICT' }, { error_code: 'EVENT_STATE_CONFLICT' }],
    });
    store.close();
  });

  it('stores member→admin snapshots with a target and CAS role', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    await createIncidentFromAlertResult(
      store,
      makeAlert({
        alertId: 'alert-baseline',
        sourceEventId: 'baseline',
        idempotencyKey: 'idempotency-baseline',
        changes: {
          membershipId: 'membership-1',
          workosEventType: 'organization_membership.updated',
          observedCurrentRole: 'member',
          observedStatus: 'active',
        },
      }),
      { preflightAlert: reserveWorkosObservedState },
    );
    const alert = makeAlert({
      alertId: 'alert-snapshot-admin',
      sourceEventId: 'snapshot-member-admin',
      idempotencyKey: 'idempotency-snapshot-admin',
      occurredAt: '2026-08-27T12:01:00.000Z',
      changes: {
        membershipId: 'membership-1',
        workosEventType: 'organization_membership.updated',
        observedCurrentRole: 'admin',
        observedStatus: 'active',
      },
    });
    await createIncidentFromAlertResult(store, alert, {
      preflightAlert: reserveWorkosObservedState,
      beforeIncidentWrite: persistWorkosSnapshotBeforeIncident,
    });
    await expect(store.execute({ sql: 'SELECT snapshot_json FROM identity_snapshots' })).resolves.toMatchObject({
      rows: [
        {
          snapshot_json:
            '{"membershipId":"membership-1","previousRole":"member","currentRole":"admin","observedCurrentRole":"admin"}',
        },
      ],
    });
    store.close();
  });

  it('derives v2 roles/actor only from the validated alert and keeps v1 privilege changes manual-review', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    await migrateOperationalStore(store);
    const alert = makeAlert({
      kind: 'unauthorized_privilege_change',
      sourceEventId: 'role-event-v2',
      actor: { id: 'actor-1', type: 'user' },
      changes: { contextVersion: 2, previousRole: 'member', nextRole: 'admin' },
    });
    const incident = await createIncidentFromAlert(store, alert);
    await materializeInvestigationStart(store, {
      eventId: 'workflow-run-v2',
      incidentId: incident.incidentId,
      tenantId: incident.tenantId,
      alertId: alert.alertId,
      correlationId: 'correlation-v2',
    });
    const context = await loadInvestigationContext(store, {
      eventId: 'workflow-run-v2',
      incidentId: incident.incidentId,
      tenantId: incident.tenantId,
      alertId: alert.alertId,
      correlationId: 'correlation-v2',
      runId: 'workflow-run-v2',
      duplicate: false,
    });
    expect(context).toMatchObject({
      schemaVersion: 2,
      actorId: 'actor-1',
      roleChange: { previousRole: 'member', currentRole: 'admin' },
    });
    const evidence = await persistEvidenceItems(store, {
      context,
      source: 'identity',
      provider: 'workos-identity',
      facts: ['role.previous', 'role.current', 'actor.id'].map(factType => ({
        semanticKey: `test-${factType}`,
        observedAt: context.occurredAt,
        factType,
        value: factType === 'role.previous' ? 'member' : factType === 'role.current' ? 'admin' : 'actor-1',
        confidence: 1,
        confidenceProvenance: 'provider' as const,
        rawPayloadRef: 'protected:test-workos',
        sensitivity: 'confidential' as const,
        incomplete: false,
      })),
    });
    // No local authorization record exists: an external alert cannot assert
    // change.approved, so policy fails closed instead of classifying it.
    expect(evaluateSeverityPolicy(context, evidence, 0)).toMatchObject({
      outcome: 'manual-review',
      reasonCodes: expect.arrayContaining(['REQUIRED_EVIDENCE_MISSING']),
    });
    await store.execute({
      sql: `INSERT INTO identity_role_change_authorizations(
        tenant_id, subject_id, source_event_id, actor_id, previous_role,
        current_role, approved, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      args: ['tenant-1', 'subject-1', 'role-event-v2', 'actor-1', 'member', 'admin', '2026-08-27T12:00:00.000Z'],
    });
    const authorized = await loadInvestigationContext(store, {
      eventId: 'workflow-run-v2',
      incidentId: incident.incidentId,
      tenantId: incident.tenantId,
      alertId: alert.alertId,
      correlationId: 'correlation-v2',
      runId: 'workflow-run-v2',
      duplicate: false,
    });
    expect(authorized.changeApproved).toBe(true);
    await store.execute({
      sql: `UPDATE identity_role_change_authorizations SET approved = 0
        WHERE tenant_id = ? AND subject_id = ? AND source_event_id = ?`,
      args: ['tenant-1', 'subject-1', 'role-event-v2'],
    });
    const denied = await loadInvestigationContext(store, {
      eventId: 'workflow-run-v2',
      incidentId: incident.incidentId,
      tenantId: incident.tenantId,
      alertId: alert.alertId,
      correlationId: 'correlation-v2',
      runId: 'workflow-run-v2',
      duplicate: false,
    });
    expect(denied.changeApproved).toBe(false);
    // A local authorization bound to a different actor/role cannot leak into
    // the v2 context and therefore still fails closed.
    await store.execute({
      sql: `UPDATE identity_role_change_authorizations SET actor_id = ?
        WHERE tenant_id = ? AND subject_id = ? AND source_event_id = ?`,
      args: ['other-actor', 'tenant-1', 'subject-1', 'role-event-v2'],
    });
    const divergent = await loadInvestigationContext(store, {
      eventId: 'workflow-run-v2',
      incidentId: incident.incidentId,
      tenantId: incident.tenantId,
      alertId: alert.alertId,
      correlationId: 'correlation-v2',
      runId: 'workflow-run-v2',
      duplicate: false,
    });
    expect(divergent.changeApproved).toBeUndefined();
    expect(evaluateSeverityPolicy(divergent, evidence, 1)).toMatchObject({
      outcome: 'manual-review',
      reasonCodes: expect.arrayContaining(['MATERIAL_CONTRADICTION']),
    });
    store.close();
  });
});
