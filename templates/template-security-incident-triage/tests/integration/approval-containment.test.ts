import { createHmac } from 'node:crypto';
import { createApprovedContainmentTool } from '../../src/mastra/tools/approved-containment-tool.js';
import type { ToolObserve } from '@mastra/core/tools';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';

import {
  consumeResumeToken,
  decideApprovalAndIssueResumeToken,
  expirePendingApproval,
  requestApproval,
} from '../../src/db/approval-operations.js';
import { createIncidentFromAlert, transitionIncident } from '../../src/db/incident-operations.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { fixedClock, type Clock } from '../../src/domain/clock.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { ContainmentGateway, identitySnapshotIntegrityHash } from '../../src/containment/gateway.js';
import { authorizeGatewayAction } from '../../src/containment/gateway-authorization.js';
import type { LocalContainmentState } from '../../src/containment/local-state.js';
import { deliverExternalIncident } from '../../src/db/provider-delivery-operations.js';
import { LocalIncidentProvider } from '../../src/providers/local-incident-provider.js';
import { WorkOsIdentityProvider } from '../../src/providers/identity-provider.js';
import { ExternalIncidentProjectionSchema, type IncidentProvider } from '../../src/providers/incident-provider.js';
import { registerApprovalRoutes } from '../../src/approval/routes.js';
import { LocalDecisionAuthenticator } from '../../src/approval/local-decision-authenticator.js';
import { ApprovalRecoveryWorker } from '../../src/workers/approval-recovery-worker.js';
import { retryPartialContainment } from '../../src/containment/partial-retry.js';
import { recordContainmentOutcome } from '../../src/db/containment-outcome-operations.js';
import { createFinalizeIncidentStep } from '../../src/mastra/steps/finalize-incident.js';
import { ContainmentExecutionResultSchema } from '../../src/approval/contracts.js';
import type { OperationalStore } from '../../src/db/operational-store.js';
import type { AppEnv } from '../../src/http-context.js';
import type { ApprovalConfig } from '../../src/env.js';
import { makeAlert, makeApprovalRequest, makePlan, seedAuthoritativeTriageResult } from '../fixtures/domain.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

async function setup(plan = makePlan()) {
  const database = await createTempDatabase();
  databases.push(database);
  const store = database.createStore();
  await migrateOperationalStore(store);
  await createIncidentFromAlert(store, makeAlert(), {
    clock: fixedClock('2026-08-27T12:00:00.000Z'),
    ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
  });
  await transitionIncident(
    store,
    {
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      expectedVersion: 0,
      to: 'investigating',
      runId: 'run-1',
      correlationId: 'correlation-1',
    },
    {
      clock: fixedClock('2026-08-27T12:00:30.000Z'),
      ids: sequenceIdGenerator(['timeline-2', 'outbox-2']),
    },
  );
  await store.execute({
    sql: `INSERT INTO workflow_runs(
      id, incident_id, tenant_id, run_id, workflow_id, status, started_at
    ) VALUES ('workflow-row-1', 'incident-1', 'tenant-1', 'run-1',
      'security-incident-workflow', 'running', '2026-08-27T12:00:30.000Z')`,
  });
  await store.execute({
    sql: `UPDATE incidents SET current_run_id = 'run-1'
      WHERE tenant_id = 'tenant-1' AND id = 'incident-1'`,
  });
  await seedAuthoritativeTriageResult(store, plan);
  const approval = makeApprovalRequest({
    planId: plan.planId,
    planHash: plan.planHash,
    expiresAt: plan.expiresAt,
  });
  await requestApproval(
    store,
    {
      plan,
      approval,
      expectedIncidentVersion: 1,
      runId: 'run-1',
      correlationId: 'correlation-1',
    },
    {
      clock: fixedClock('2026-08-27T12:01:00.000Z'),
      ids: sequenceIdGenerator([
        ...plan.actions.map((_, index) => `action-row-${index + 1}`),
        'timeline-3',
        'outbox-3',
      ]),
    },
  );
  return { database, store, plan, approval };
}

async function setupAdditionalApprovedIncident(
  store: Awaited<ReturnType<typeof setup>>['store'],
  actionType: 'restore_previous_role' | 'revoke_session',
) {
  const baseAction = makePlan().actions[0]!;
  const actionInput: Record<string, string | number | boolean | null> =
    actionType === 'revoke_session' ? {} : { role: 'member' };
  const action = {
    ...baseAction,
    actionId: 'action-2',
    type: actionType,
    targetId: actionType === 'revoke_session' ? 'session-2' : 'subject-2',
    input: actionInput,
  };
  const plan = makePlan({
    planId: 'plan-2',
    incidentId: 'incident-2',
    actions: [action],
  });
  await createIncidentFromAlert(
    store,
    makeAlert({
      alertId: 'alert-2',
      sourceEventId: 'source-event-2',
      subjectId: 'subject-2',
      target: { id: 'subject-2', type: 'user' },
      rawPayloadRef: 'protected://alerts/2',
      idempotencyKey: 'alert-idempotency-2',
    }),
    {
      clock: fixedClock('2026-08-27T12:00:00.000Z'),
      ids: sequenceIdGenerator(['incident-2', 'timeline-incident-2', 'outbox-incident-2']),
    },
  );
  await transitionIncident(
    store,
    {
      tenantId: 'tenant-1',
      incidentId: 'incident-2',
      expectedVersion: 0,
      to: 'investigating',
      runId: 'run-2',
      correlationId: 'correlation-2',
    },
    {
      clock: fixedClock('2026-08-27T12:00:30.000Z'),
      ids: sequenceIdGenerator(['timeline-investigating-2', 'outbox-investigating-2']),
    },
  );
  await store.execute({
    sql: `INSERT INTO workflow_runs(
      id, incident_id, tenant_id, run_id, workflow_id, status, started_at
    ) VALUES ('workflow-row-2', 'incident-2', 'tenant-1', 'run-2',
      'security-incident-workflow', 'running', '2026-08-27T12:00:30.000Z')`,
  });
  await store.execute({
    sql: `UPDATE incidents SET current_run_id = 'run-2'
      WHERE tenant_id = 'tenant-1' AND id = 'incident-2'`,
  });
  await seedAuthoritativeTriageResult(store, plan, 'run-2');
  await requestApproval(
    store,
    {
      plan,
      approval: makeApprovalRequest({
        approvalId: 'approval-2',
        planId: plan.planId,
        incidentId: plan.incidentId,
        planHash: plan.planHash,
        expiresAt: plan.expiresAt,
      }),
      expectedIncidentVersion: 1,
      runId: 'run-2',
      correlationId: 'correlation-2',
    },
    {
      clock: fixedClock('2026-08-27T12:01:00.000Z'),
      ids: sequenceIdGenerator(['action-row-2', 'timeline-approval-2', 'outbox-approval-2']),
    },
  );
  await decideApprovalAndIssueResumeToken(
    store,
    {
      decision: {
        schemaVersion: 1,
        approvalId: 'approval-2',
        planId: plan.planId,
        incidentId: plan.incidentId,
        tenantId: plan.tenantId,
        planHashVersion: 1,
        planHash: plan.planHash,
        decision: 'approved',
        decidedBy: 'studio-soc-manager',
        decidedByRole: 'soc_manager',
        decidedAt: '2026-08-27T12:02:00.000Z',
      },
      expectedIncidentVersion: 2,
      runId: 'run-2',
      correlationId: 'correlation-2',
      resumeSecret: 'resume-secret-'.padEnd(40, 'x'),
    },
    {
      clock: fixedClock('2026-08-27T12:02:00.000Z'),
      ids: sequenceIdGenerator(['timeline-decision-2', 'outbox-decision-2']),
    },
  );
  return { plan, action };
}

function schemaValidPlanTamperings(plan: ReturnType<typeof makePlan>) {
  const [action, ...remainingActions] = plan.actions;
  if (!action) throw new Error('fixture plan must contain an action');
  return [
    {
      ...plan,
      actions: [{ ...action, actionId: `${action.actionId}-tampered` }, ...remainingActions],
    },
    {
      ...plan,
      actions: [{ ...action, targetId: `${action.targetId}-tampered` }, ...remainingActions],
    },
    {
      ...plan,
      actions: [{ ...action, input: { ...action.input, role: 'viewer' } }, ...remainingActions],
    },
  ];
}

async function approve(
  store: Awaited<ReturnType<typeof setup>>['store'],
  plan = makePlan(),
  provenance: 'local' | 'dashboard' = 'local',
) {
  return decideApprovalAndIssueResumeToken(
    store,
    {
      decision: {
        schemaVersion: 1,
        approvalId: 'approval-1',
        planId: plan.planId,
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        planHashVersion: 1,
        planHash: plan.planHash,
        decision: 'approved',
        decidedBy: provenance === 'dashboard' ? 'workos:user_dashboard_manager' : 'studio-soc-manager',
        decidedByRole: 'soc_manager',
        decidedAt: '2026-08-27T12:02:00.000Z',
      },
      expectedIncidentVersion: 2,
      runId: 'run-1',
      correlationId: 'correlation-1',
      resumeSecret: 'resume-secret-'.padEnd(40, 'x'),
      decisionProvenance: provenance,
    },
    {
      clock: fixedClock('2026-08-27T12:02:00.000Z'),
      ids: sequenceIdGenerator(['timeline-4', 'outbox-4']),
    },
  );
}

async function preparePartialContainmentFailure(
  store: Awaited<ReturnType<typeof setup>>['store'],
  plan: ReturnType<typeof makePlan>,
) {
  const [first, second] = plan.actions;
  if (!first || !second) throw new Error('fixture plan must have two actions');
  await approve(store, plan);
  await transitionIncident(
    store,
    {
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      expectedVersion: 3,
      to: 'containing',
      runId: 'run-1',
      correlationId: 'correlation-1',
      causationId: 'approval-1',
    },
    {
      clock: fixedClock('2026-08-27T12:03:00.000Z'),
      ids: sequenceIdGenerator(['containing-timeline', 'containing-outbox']),
    },
  );
  const state = mockState();
  state.roles.set('subject-1', 'admin');
  state.sessions.set('session-1', 'active');
  state.failActions = new Set([second.actionId]);
  const gateway = gatewayFor(store, state);
  await gateway.executeApprovedAction({
    tenantId: 'tenant-1',
    incidentId: 'incident-1',
    workflowRunId: 'run-1',
    approvalId: 'approval-1',
    plan,
    action: first,
  });
  await gateway.executeApprovedAction({
    tenantId: 'tenant-1',
    incidentId: 'incident-1',
    workflowRunId: 'run-1',
    approvalId: 'approval-1',
    plan,
    action: second,
  });
  await recordContainmentOutcome(
    store,
    {
      tenantId: 'tenant-1',
      incidentId: 'incident-1',
      workflowRunId: 'run-1',
      correlationId: 'correlation-1',
      approvalId: 'approval-1',
      expectedVersion: 4,
      status: 'failed',
      partial: true,
      completedCount: 1,
      failedCount: 1,
    },
    {
      clock: fixedClock('2026-08-27T12:03:00.000Z'),
      ids: sequenceIdGenerator(['failed-timeline', 'failed-outbox']),
    },
  );
  state.failActions.clear();
  return { first, second, state };
}

async function reject(store: Awaited<ReturnType<typeof setup>>['store'], plan = makePlan()) {
  return decideApprovalAndIssueResumeToken(
    store,
    {
      decision: {
        schemaVersion: 1,
        approvalId: 'approval-1',
        planId: plan.planId,
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        planHashVersion: 1,
        planHash: plan.planHash,
        decision: 'rejected',
        reason: 'manager rejected containment',
        decidedBy: 'studio-soc-manager',
        decidedByRole: 'soc_manager',
        decidedAt: '2026-08-27T12:02:00.000Z',
      },
      expectedIncidentVersion: 2,
      runId: 'run-1',
      correlationId: 'correlation-1',
      resumeSecret: 'resume-secret-'.padEnd(40, 'x'),
    },
    {
      clock: fixedClock('2026-08-27T12:02:00.000Z'),
      ids: sequenceIdGenerator(['timeline-4', 'outbox-4']),
    },
  );
}

async function readTriagePayload(store: OperationalStore) {
  const result = await store.execute({
    sql: `SELECT triage_result_json FROM workflow_runs WHERE run_id = 'run-1'`,
  });
  return JSON.parse(String(result.rows[0]?.triage_result_json)) as {
    decision: unknown;
    summary: unknown;
  };
}

describe('native approval-gated containment tool', () => {
  const observe: ToolObserve = {
    span: async (_name, fn) => fn(),
    log: () => {},
  };
  it.each(['missing', 'pending', 'rejected', 'expired', 'stale-plan', 'cross-tenant', 'cross-run', 'unknown-action'])(
    'blocks %s authority with zero provider effects',
    async scenario => {
      const { store, plan } = await setup();
      const state = mockState();
      state.roles.set('subject-1', 'admin');
      try {
        if (scenario === 'rejected') await reject(store, plan);
        else if (!['missing', 'pending'].includes(scenario)) await approve(store, plan);
        const gateway =
          scenario === 'expired'
            ? new ContainmentGateway({
                store,
                state,
                mode: 'local',
                timeoutMs: 1000,
                rateLimit: 8,
                clock: fixedClock('2026-08-27T12:17:00.000Z'),
              })
            : gatewayFor(store, state);
        const tool = createApprovedContainmentTool(gateway, {
          tenantId: scenario === 'cross-tenant' ? 'tenant-other' : 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: scenario === 'cross-run' ? 'run-other' : 'run-1',
          approvalId: scenario === 'missing' ? 'approval-missing' : 'approval-1',
          plan: scenario === 'stale-plan' ? { ...plan, planVersion: plan.planVersion + 1 } : plan,
        });
        expect(tool.requireApproval).toBe(true);
        await expect(
          tool.execute!(
            {
              actionId: scenario === 'unknown-action' ? 'unknown' : plan.actions[0]!.actionId,
            },
            { observe },
          ),
        ).rejects.toThrow();
        expect(state.calls.size).toBe(0);
        expect(
          (
            await store.execute({
              sql: 'SELECT count(*) AS count FROM local_containment_effects',
            })
          ).rows[0]!.count,
        ).toBe(0);
      } finally {
        store.close();
      }
    },
  );
  it('executes an approved selection once even when native execute is called directly twice', async () => {
    const { store, plan } = await setup();
    const state = mockState();
    state.roles.set('subject-1', 'admin');
    try {
      await approve(store, plan);
      const tool = createApprovedContainmentTool(gatewayFor(store, state), {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
      });
      const selection = { actionId: plan.actions[0]!.actionId };
      await expect(tool.execute!(selection, { observe })).resolves.toMatchObject({
        status: 'completed',
        verification: 'verified',
      });
      await expect(tool.execute!(selection, { observe })).resolves.toMatchObject({
        status: 'completed',
        verification: 'verified',
      });
      expect(
        (
          await store.execute({
            sql: 'SELECT count(*) AS count FROM local_containment_effects',
          })
        ).rows[0]!.count,
      ).toBe(1);
      expect([...state.calls.values()].reduce((sum, count) => sum + count, 0)).toBe(1);
    } finally {
      store.close();
    }
  });
});

describe('approval and containment durable approval and containment', () => {
  it('rejects a self-consistent plan that diverges from the authoritative triage result or TTL', async () => {
    const { store } = await setup();
    try {
      const longLived = makePlan({
        planId: 'plan-long-lived',
        expiresAt: '2026-08-28T12:01:00.000Z',
      });
      await expect(
        requestApproval(
          store,
          {
            plan: longLived,
            approval: makeApprovalRequest({
              approvalId: 'approval-long-lived',
              planId: longLived.planId,
              planHash: longLived.planHash,
              expiresAt: longLived.expiresAt,
            }),
            expectedIncidentVersion: 2,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock: fixedClock('2026-08-27T12:02:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

      const changed = makePlan({
        planId: 'plan-changed',
        actions: [
          {
            ...makePlan().actions[0]!,
            actionId: 'action-changed',
            targetId: 'subject-2',
          },
        ],
      });
      await expect(
        requestApproval(
          store,
          {
            plan: changed,
            approval: makeApprovalRequest({
              approvalId: 'approval-changed',
              planId: changed.planId,
              planHash: changed.planHash,
            }),
            expectedIncidentVersion: 2,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock: fixedClock('2026-08-27T12:02:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    } finally {
      store.close();
    }
  });

  it('closes an expired pending approval as failed with zero containment attempts', async () => {
    const { store } = await setup();
    try {
      await expect(
        expirePendingApproval(
          store,
          {
            tenantId: 'tenant-1',
            incidentId: 'incident-1',
            approvalId: 'approval-1',
            workflowRunId: 'run-1',
            correlationId: 'correlation-1',
          },
          {
            clock: fixedClock('2026-08-27T13:00:00.000Z'),
            ids: sequenceIdGenerator(['timeline-expired', 'outbox-expired']),
          },
        ),
      ).resolves.toBe(true);
      const state = await store.execute({
        sql: `SELECT i.status,
          (SELECT count(*) FROM containment_action_attempts) AS attempts,
          (SELECT count(*) FROM timeline_events WHERE type = 'approval.expired') AS expiry_events
          FROM incidents i WHERE i.id = 'incident-1'`,
      });
      expect(state.rows[0]).toEqual({
        status: 'failed',
        attempts: 0,
        expiry_events: 1,
      });
    } finally {
      store.close();
    }
  });

  it('retries expiry resume after a process failure following the expiry commit', async () => {
    const { store } = await setup();
    try {
      const clock = fixedClock('2026-08-27T13:00:00.000Z');
      const first = new ApprovalRecoveryWorker({
        store,
        provider: new LocalIncidentProvider(),
        clock,
        ids: sequenceIdGenerator(['expiry-timeline', 'expiry-outbox']),
        reconcileApprovalRun: async () => {
          throw new Error('process stopped before workflow resume');
        },
      });
      await expect(first.runOnce()).rejects.toThrow('process stopped before workflow resume');
      const committed = await store.execute({
        sql: `SELECT i.status, a.expiry_resumed_at FROM incidents i
          JOIN approvals a ON a.tenant_id = i.tenant_id AND a.incident_id = i.id`,
      });
      expect(committed.rows[0]).toEqual({
        status: 'failed',
        expiry_resumed_at: null,
      });
      let resumed = 0;
      const restarted = new ApprovalRecoveryWorker({
        store,
        provider: new LocalIncidentProvider(),
        clock,
        reconcileApprovalRun: async () => {
          resumed += 1;
          return 'completed';
        },
      });
      await expect(restarted.runOnce()).resolves.toMatchObject({ expired: 1 });
      expect(resumed).toBe(1);
      const marker = await store.execute({
        sql: 'SELECT expiry_resumed_at FROM approvals',
      });
      expect(marker.rows[0]?.expiry_resumed_at).toBe('2026-08-27T13:00:00.000Z');
    } finally {
      store.close();
    }
  });

  it('decides through the authenticated route without returning the resume token', async () => {
    const { store, plan } = await setup();
    try {
      const app = new Hono<AppEnv>();
      app.use('*', async (context, next) => {
        context.set('requestId', 'request-1');
        context.set('correlationId', 'correlation-1');
        await next();
      });
      const timestamp = Date.parse('2026-08-27T12:02:00.000Z');
      const secret = 'decision-secret-'.padEnd(40, 'x');
      const resumed: Array<{
        workflowRunId: string;
        resumeReceiptId: string;
      }> = [];
      const config: ApprovalConfig = {
        mode: 'local',
        localApprovalsEnabled: true,
        localApprovalSecret: secret,
        approvalResumeSecret: 'resume-secret-'.padEnd(40, 'x'),
        actionTimeoutMs: 1_000,
        rateLimit: 8,
      };
      registerApprovalRoutes(app, {
        config,
        store,
        logger: { write: () => {} },
        authenticator: new LocalDecisionAuthenticator({
          mode: 'local',
          enabled: true,
          secret,
          nowMs: () => timestamp,
        }),
        reconcileApprovalRun: async input => {
          resumed.push(input);
          return 'completed';
        },
        clock: fixedClock('2026-08-27T12:02:00.000Z'),
      });
      const path = '/api/incidents/incident-1/approvals/approval-1/decision';
      const body = JSON.stringify({
        decision: 'approved',
        planId: plan.planId,
        planHashVersion: 1,
        planHash: plan.planHash,
      });
      const nonce = 'route-nonce-1234567890';
      const signature = createHmac('sha256', secret)
        .update(`${timestamp}.${nonce}.POST.${path}.`)
        .update('tenant-1.')
        .update(body)
        .digest('hex');
      const response = await app.request(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Decision-Signature': `t=${timestamp},v1=${signature}`,
          'X-Decision-Nonce': nonce,
          'X-Decision-Tenant': 'tenant-1',
        },
        body,
      });
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toMatchObject({ decision: 'approved', resumed: true });
      expect(JSON.stringify(json)).not.toContain('resumeToken');
      expect(resumed).toHaveLength(1);
      expect(resumed[0]!.workflowRunId).toBe('run-1');
    } finally {
      store.close();
    }
  });

  it('stores only a token digest, consumes it once, and rejects stolen/replayed tokens', async () => {
    const { store } = await setup();
    try {
      const issued = await approve(store);
      const persisted = await store.execute({
        sql: 'SELECT token_digest, consumed_at FROM approval_resume_tokens',
      });
      expect(persisted.rows[0]?.token_digest).toMatch(/^[a-f0-9]{64}$/u);
      expect(JSON.stringify(persisted.rows)).not.toContain(issued.resumeToken);
      await expect(
        consumeResumeToken(
          store,
          {
            token: issued.resumeToken,
            tenantId: 'tenant-2',
            incidentId: 'incident-1',
            workflowRunId: 'run-1',
            approvalId: 'approval-1',
          },
          { clock: fixedClock('2026-08-27T12:03:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      await expect(
        consumeResumeToken(
          store,
          {
            token: issued.resumeToken,
            tenantId: 'tenant-1',
            incidentId: 'incident-1',
            workflowRunId: 'run-1',
            approvalId: 'approval-1',
          },
          { clock: fixedClock('2026-08-27T12:03:00.000Z') },
        ),
      ).resolves.toMatchObject({
        decision: 'approved',
        decidedByRole: 'soc_manager',
      });
      await expect(
        consumeResumeToken(
          store,
          {
            token: issued.resumeToken,
            tenantId: 'tenant-1',
            incidentId: 'incident-1',
            workflowRunId: 'run-1',
            approvalId: 'approval-1',
          },
          { clock: fixedClock('2026-08-27T12:04:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    } finally {
      store.close();
    }
  });

  it('reconciles a consumed receipt after recovery already closed the run', async () => {
    const { store } = await setup();
    try {
      const issued = await approve(store);
      await consumeResumeToken(
        store,
        {
          token: issued.resumeToken,
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
          approvalId: 'approval-1',
        },
        { clock: fixedClock('2026-08-27T12:03:00.000Z') },
      );
      await store.execute({
        sql: `UPDATE incidents SET status = 'closed', closed_at = ?, updated_at = ?
          WHERE tenant_id = 'tenant-1' AND id = 'incident-1'`,
        args: ['2026-08-27T12:04:00.000Z', '2026-08-27T12:04:00.000Z'],
      });
      await store.execute({
        sql: `UPDATE workflow_runs SET status = 'completed', finished_at = ?
          WHERE run_id = 'run-1'`,
        args: ['2026-08-27T12:04:00.000Z'],
      });
      let resumeCalls = 0;
      const recovery = new ApprovalRecoveryWorker({
        store,
        provider: new LocalIncidentProvider(),
        clock: fixedClock('2026-08-27T12:05:00.000Z'),
        reconcileApprovalRun: async () => {
          resumeCalls += 1;
          return 'completed';
        },
      });

      await expect(recovery.runOnce()).resolves.toMatchObject({ resumed: 1 });
      expect(resumeCalls).toBe(0);
      await expect(
        store.execute({
          sql: "SELECT resumed_at FROM approval_resume_tokens WHERE approval_id = 'approval-1'",
        }),
      ).resolves.toMatchObject({
        rows: [{ resumed_at: '2026-08-27T12:05:00.000Z' }],
      });
    } finally {
      store.close();
    }
  });

  it('replays the persisted decision timestamp without issuing a different token', async () => {
    const { store, plan } = await setup();
    try {
      const first = await approve(store, plan);
      const replay = await decideApprovalAndIssueResumeToken(
        store,
        {
          decision: {
            ...first.decision,
            decidedAt: '2026-08-27T12:03:00.000Z',
          },
          expectedIncidentVersion: 3,
          runId: 'run-1',
          correlationId: 'correlation-replay',
          resumeSecret: 'resume-secret-'.padEnd(40, 'x'),
        },
        { clock: fixedClock('2026-08-27T12:03:00.000Z') },
      );
      expect(replay.decision.decidedAt).toBe('2026-08-27T12:02:00.000Z');
      expect(replay.resumeToken).toBe(first.resumeToken);
    } finally {
      store.close();
    }
  });

  it('rejects cross-bound token and action-attempt ledger rows at the database boundary', async () => {
    const { store, plan } = await setup();
    try {
      await approve(store, plan);
      const approval = await store.execute({
        sql: `SELECT decision_fingerprint, expires_at FROM approvals
          WHERE id = 'approval-1'`,
      });
      await expect(
        store.execute({
          sql: `INSERT INTO approval_resume_tokens(
            id, tenant_id, incident_id, workflow_run_id, approval_id, decision,
            decision_fingerprint, digest_version, token_digest, issued_at, expires_at
          ) VALUES ('wrong-run-token', 'tenant-1', 'incident-1', 'run-other',
            'approval-1', 'approved', ?, 1, ?,
            '2026-08-27T12:02:00.000Z', ?)`,
          args: [String(approval.rows[0]!.decision_fingerprint), 'f'.repeat(64), String(approval.rows[0]!.expires_at)],
        }),
      ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
      await expect(
        store.execute({
          sql: `INSERT INTO containment_action_attempts(
            id, tenant_id, incident_id, plan_id, approval_id, action_id,
            idempotency_key, attempt, owner_id, fence_token, status,
            started_at, finished_at, lease_expires_at, verification, error_code
          ) VALUES ('wrong-action-attempt', 'tenant-1', 'incident-1', ?,
            'approval-1', 'action-not-in-plan', 'wrong-key', 1, 'run-1',
            'wrong-fence', 'failed', '2026-08-27T12:03:00.000Z',
            '2026-08-27T12:03:00.000Z', '2026-08-27T12:04:00.000Z',
            'not_run', 'PROVIDER_FAILED')`,
          args: [plan.planId],
        }),
      ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
    } finally {
      store.close();
    }
  });

  it('makes rejection authoritative while executing zero containment actions', async () => {
    const { store, plan } = await setup();
    try {
      const rejected = await decideApprovalAndIssueResumeToken(
        store,
        {
          decision: {
            schemaVersion: 1,
            approvalId: 'approval-1',
            planId: plan.planId,
            incidentId: 'incident-1',
            tenantId: 'tenant-1',
            planHashVersion: 1,
            planHash: plan.planHash,
            decision: 'rejected',
            reason: 'Additional evidence is required.',
            decidedBy: 'studio-soc-manager',
            decidedByRole: 'soc_manager',
            decidedAt: '2026-08-27T12:02:00.000Z',
          },
          expectedIncidentVersion: 2,
          runId: 'run-1',
          correlationId: 'correlation-1',
          resumeSecret: 'resume-secret-'.padEnd(40, 'x'),
        },
        {
          clock: fixedClock('2026-08-27T12:02:00.000Z'),
          ids: sequenceIdGenerator(['timeline-rejected', 'outbox-rejected']),
        },
      );
      await expect(
        consumeResumeToken(
          store,
          {
            token: rejected.resumeToken,
            tenantId: 'tenant-1',
            incidentId: 'incident-1',
            workflowRunId: 'run-1',
            approvalId: 'approval-1',
          },
          { clock: fixedClock('2026-08-27T12:03:00.000Z') },
        ),
      ).resolves.toMatchObject({ decision: 'rejected' });
      const state = mockState();
      await expect(
        gatewayFor(store, state).executeApprovedAction({
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
          approvalId: 'approval-1',
          plan,
          action: plan.actions[0]!,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      const count = await store.execute({
        sql: 'SELECT count(*) AS count FROM containment_action_attempts',
      });
      expect(Number(count.rows[0]?.count)).toBe(0);
      expect(state.calls.size).toBe(0);
    } finally {
      store.close();
    }
  });

  it('executes through the gateway once and rejects tampering/non-mock mode', async () => {
    const { store, plan } = await setup();
    try {
      await approve(store, plan);
      const state = mockState();
      state.roles.set('subject-1', 'admin');
      const gateway = gatewayFor(store, state);
      const input = {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action: plan.actions[0]!,
      };
      const concurrent = await Promise.allSettled([
        gateway.executeApprovedAction(input),
        gateway.executeApprovedAction(input),
      ]);
      expect(concurrent.some(result => result.status === 'fulfilled' && result.value.status === 'completed')).toBe(
        true,
      );
      await expect(gateway.executeApprovedAction(input)).resolves.toMatchObject({
        status: 'completed',
        verification: 'verified',
      });
      expect(state.calls.get(plan.actions[0]!.actionId)).toBe(1);
      await expect(
        gateway.executeApprovedAction({
          ...input,
          action: { ...plan.actions[0]!, targetId: 'subject-2' },
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      await expect(gatewayFor(store, state, 'staging').executeApprovedAction(input)).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      });
    } finally {
      store.close();
    }
  });

  it('accepts an authenticated dashboard decision in local runtime', async () => {
    const { store, plan } = await setup();
    try {
      await approve(store, plan, 'dashboard');
      const state = mockState();
      state.roles.set('subject-1', 'admin');

      await expect(
        gatewayFor(store, state).executeApprovedAction({
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
          approvalId: 'approval-1',
          plan,
          action: plan.actions[0]!,
        }),
      ).resolves.toMatchObject({
        status: 'completed',
        verification: 'verified',
      });
      expect(state.calls.get(plan.actions[0]!.actionId)).toBe(1);
    } finally {
      store.close();
    }
  });

  it('blocks a changed precondition before the mock provider effect', async () => {
    const { store, plan } = await setup();
    try {
      await approve(store, plan);
      const state = mockState();
      state.roles.set('subject-1', 'owner');
      const result = await gatewayFor(store, state).executeApprovedAction({
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action: plan.actions[0]!,
      });
      expect(result).toMatchObject({
        status: 'blocked',
        errorCode: 'PRECONDITION_FAILED',
      });
      expect(state.calls.get(plan.actions[0]!.actionId)).toBeUndefined();
      expect(state.roles.get('subject-1')).toBe('owner');
    } finally {
      store.close();
    }
  });

  it('audits a structurally invalid gateway payload before schema parsing', async () => {
    const { store } = await setup();
    try {
      const gateway = gatewayFor(store, mockState());
      await expect(
        gateway.executeApprovedAction({
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
          approvalId: 'approval-1',
          plan: {} as never,
          action: {} as never,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      const audit = await store.execute({
        sql: `SELECT claimed_tenant_id, claimed_incident_id, claimed_plan_id,
          claimed_action_id, outcome, reason_code
          FROM containment_gateway_audit ORDER BY rowid DESC LIMIT 1`,
      });
      expect(audit.rows[0]).toEqual({
        claimed_tenant_id: 'tenant-1',
        claimed_incident_id: 'incident-1',
        claimed_plan_id: 'invalid-plan',
        claimed_action_id: 'invalid-action',
        outcome: 'invalid',
        reason_code: 'BINDING_INVALID',
      });
    } finally {
      store.close();
    }
  });

  it('recovers an after-effect provider failure by verification without a duplicate call', async () => {
    const { store, plan } = await setup();
    try {
      await approve(store, plan);
      const state = mockState();
      state.roles.set('subject-1', 'admin');
      state.failAfterEffectActions = new Set([plan.actions[0]!.actionId]);
      const gateway = gatewayFor(store, state);
      const input = {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action: plan.actions[0]!,
      };
      await expect(gateway.executeApprovedAction(input)).resolves.toMatchObject({
        status: 'completed',
        verification: 'verified',
      });
      await expect(gateway.executeApprovedAction(input)).resolves.toMatchObject({
        status: 'completed',
        verification: 'verified',
      });
      expect(state.calls.get(plan.actions[0]!.actionId)).toBe(1);
    } finally {
      store.close();
    }
  });

  it('binds a staged WorkOS revoke to the active containment action fence and durable ledger', async () => {
    const action = {
      ...makePlan().actions[0]!,
      type: 'revoke_session' as const,
      targetId: 'session-1',
      input: {},
    };
    const plan = makePlan({ actions: [action] });
    const { store } = await setup(plan);
    try {
      await approve(store, plan, 'dashboard');
      let revoked = false;
      const identityProvider = new WorkOsIdentityProvider({
        client: {
          userManagement: {
            listOrganizationMemberships: async ({
              userId,
              organizationId,
            }: {
              userId: string;
              organizationId: string;
            }) => ({
              data: [{ userId, organizationId, status: 'active' }],
            }),
            getUser: async () => ({ id: 'subject-1', status: 'active' }),
            listSessions: async () => ({
              data: [
                {
                  id: 'session-1',
                  userId: 'subject-1',
                  organizationId: 'tenant-1',
                  status: revoked ? 'revoked' : 'active',
                },
              ],
            }),
            revokeSession: async () => {
              revoked = true;
              return {
                id: 'session-1',
                userId: 'subject-1',
                status: 'revoked',
              };
            },
          },
          organizations: {
            getMembership: async () => ({}),
            updateMembership: async () => ({}),
          },
        },
        organizationId: 'tenant-1',
        allowedUserIds: new Set(['subject-1']),
        allowedRoleSlugs: new Set(['member']),
        authorizeMutation: () => true,
        store,
        now: () => Date.parse('2026-08-27T12:03:00.000Z'),
      });
      const gateway = new ContainmentGateway({
        store,
        state: mockState(),
        mode: 'staging',
        timeoutMs: 1_000,
        rateLimit: 8,
        identityProvider,
        clock: fixedClock('2026-08-27T12:03:00.000Z'),
      });
      await expect(
        gateway.executeApprovedAction({
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
          approvalId: 'approval-1',
          plan,
          action,
        }),
      ).resolves.toMatchObject({
        status: 'completed',
        verification: 'verified',
        providerRef: 'workos:session-1',
      });
      const ledger = await store.execute({
        sql: `SELECT tenant_id, incident_id, plan_id, action_id, target_id, status
          FROM provider_effect_ledger WHERE provider = 'workos'`,
      });
      expect(ledger.rows).toEqual([
        {
          tenant_id: 'tenant-1',
          incident_id: 'incident-1',
          plan_id: 'plan-1',
          action_id: 'action-1',
          target_id: 'session-1',
          status: 'succeeded',
        },
      ]);
      expect(revoked).toBe(true);
    } finally {
      store.close();
    }
  });

  it('restores only the incident-bound approved snapshot when a newer incident has another role transition', async () => {
    const { store, plan } = await setup();
    try {
      await approve(store, plan, 'dashboard');
      await createIncidentFromAlert(
        store,
        makeAlert({
          alertId: 'alert-2',
          sourceEventId: 'source-event-2',
          idempotencyKey: 'alert-idempotency-2',
          rawPayloadRef: 'protected://alerts/2',
          occurredAt: '2026-08-27T12:01:00.000Z',
          changes: { previousRole: 'admin', nextRole: 'viewer' },
        }),
        {
          clock: fixedClock('2026-08-27T12:01:00.000Z'),
          ids: sequenceIdGenerator(['incident-2', 'timeline-incident-2', 'outbox-incident-2']),
        },
      );
      const insertSnapshot = async (
        incidentId: string,
        sourceEventId: string,
        previousRole: 'member' | 'admin',
        observedCurrentRole: 'admin' | 'viewer',
        capturedAt: string,
      ) => {
        const snapshot = {
          membershipId: 'membership-1',
          previousRole,
          currentRole: observedCurrentRole,
          observedCurrentRole,
        };
        const snapshotRef = `protected://workos/snapshot/${sourceEventId}`;
        await store.execute({
          sql: `INSERT INTO identity_snapshots(
            id, tenant_id, incident_id, subject_id, source_event_id, snapshot_json,
            snapshot_ref, integrity_hash, schema_version, captured_at
          ) VALUES (?, 'tenant-1', ?, 'subject-1', ?, ?, ?, ?, 1, ?)`,
          args: [
            `snapshot-${incidentId}`,
            incidentId,
            sourceEventId,
            JSON.stringify(snapshot),
            snapshotRef,
            identitySnapshotIntegrityHash({
              tenantId: 'tenant-1',
              incidentId,
              subjectId: 'subject-1',
              sourceEventId,
              snapshot,
              snapshotRef,
              schemaVersion: 1,
            }),
            capturedAt,
          ],
        });
      };
      await insertSnapshot('incident-1', 'source-event-1', 'member', 'admin', '2026-08-27T12:00:00.000Z');
      // This is deliberately newer, for the same tenant and subject. It may
      // never replace Incident 1's approved member restore semantics.
      await insertSnapshot('incident-2', 'source-event-2', 'admin', 'viewer', '2026-08-27T12:01:00.000Z');
      let role: 'admin' | 'member' = 'admin';
      let mutations = 0;
      let callbackWasArmedBeforeMutation = false;
      const identityProvider = new WorkOsIdentityProvider({
        client: {
          userManagement: {
            listOrganizationMemberships: async ({
              userId,
              organizationId,
            }: {
              userId: string;
              organizationId: string;
            }) => ({
              data: [{ userId, organizationId, status: 'active' }],
            }),
            getUser: async () => ({ id: 'subject-1', status: 'active' }),
            listSessions: async () => ({ data: [] }),
            revokeSession: async () => ({}),
          },
          organizations: {
            getMembership: async () => ({
              id: 'membership-1',
              userId: 'subject-1',
              organizationId: 'tenant-1',
              roleSlug: role,
              status: 'active',
            }),
            updateMembership: async (_id, input) => {
              const expectedCallback = await store.execute({
                sql: `SELECT status FROM workos_expected_membership_callbacks
                  WHERE membership_id = 'membership-1'`,
              });
              callbackWasArmedBeforeMutation = expectedCallback.rows[0]?.status === 'armed';
              mutations += 1;
              role = input.roleSlug as 'member';
              return {
                id: 'membership-1',
                userId: 'subject-1',
                organizationId: 'tenant-1',
                roleSlug: role,
                status: 'active',
              };
            },
          },
        },
        organizationId: 'tenant-1',
        allowedUserIds: new Set(['subject-1']),
        allowedRoleSlugs: new Set(['member', 'admin', 'viewer']),
        authorizeMutation: () => true,
        store,
        now: () => Date.parse('2026-08-27T12:03:00.000Z'),
      });
      const gateway = new ContainmentGateway({
        store,
        state: mockState(),
        mode: 'staging',
        timeoutMs: 1_000,
        rateLimit: 8,
        identityProvider,
        clock: fixedClock('2026-08-27T12:03:00.000Z'),
      });
      const gatewayInput = {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action: plan.actions[0]!,
      };
      const concurrent = await Promise.allSettled([
        gateway.executeApprovedAction(gatewayInput),
        gateway.executeApprovedAction(gatewayInput),
      ]);
      expect(
        concurrent.filter(result => result.status === 'fulfilled' && result.value.status === 'completed'),
      ).toHaveLength(1);
      expect(
        concurrent.some(
          result =>
            result.status === 'rejected' &&
            result.reason instanceof Error &&
            'code' in result.reason &&
            result.reason.code === 'CONFLICT',
        ),
      ).toBe(true);
      expect({ role, mutations }).toEqual({ role: 'member', mutations: 1 });
      expect(callbackWasArmedBeforeMutation).toBe(true);
      await expect(
        store.execute({
          sql: `SELECT incident_id, source_event_id FROM identity_snapshots
            WHERE tenant_id = 'tenant-1' ORDER BY captured_at`,
        }),
      ).resolves.toMatchObject({
        rows: [
          { incident_id: 'incident-1', source_event_id: 'source-event-1' },
          { incident_id: 'incident-2', source_event_id: 'source-event-2' },
        ],
      });
    } finally {
      store.close();
    }
  });

  it('blocks a restore snapshot whose source event is not the approved incident alert', async () => {
    const { store, plan } = await setup();
    try {
      await approve(store, plan, 'dashboard');
      const snapshot = {
        membershipId: 'membership-1',
        previousRole: 'member',
        currentRole: 'admin',
        observedCurrentRole: 'admin',
      };
      const snapshotRef = 'protected://workos/snapshot/not-the-alert';
      await store.execute({
        sql: `INSERT INTO identity_snapshots(
          id, tenant_id, incident_id, subject_id, source_event_id, snapshot_json,
          snapshot_ref, integrity_hash, schema_version, captured_at
        ) VALUES ('snapshot-wrong-source', 'tenant-1', 'incident-1', 'subject-1',
          'not-the-alert', ?, ?, ?, 1, '2026-08-27T12:00:00.000Z')`,
        args: [
          JSON.stringify(snapshot),
          snapshotRef,
          identitySnapshotIntegrityHash({
            tenantId: 'tenant-1',
            incidentId: 'incident-1',
            subjectId: 'subject-1',
            sourceEventId: 'not-the-alert',
            snapshot,
            snapshotRef,
            schemaVersion: 1,
          }),
        ],
      });
      let mutations = 0;
      const identityProvider = new WorkOsIdentityProvider({
        client: {
          userManagement: {
            listOrganizationMemberships: async ({
              userId,
              organizationId,
            }: {
              userId: string;
              organizationId: string;
            }) => ({
              data: [{ userId, organizationId, status: 'active' }],
            }),
            getUser: async () => ({ id: 'subject-1', status: 'active' }),
            listSessions: async () => ({ data: [] }),
            revokeSession: async () => ({}),
          },
          organizations: {
            getMembership: async () => ({
              id: 'membership-1',
              userId: 'subject-1',
              organizationId: 'tenant-1',
              roleSlug: 'admin',
              status: 'active',
            }),
            updateMembership: async () => {
              mutations += 1;
              return {};
            },
          },
        },
        organizationId: 'tenant-1',
        allowedUserIds: new Set(['subject-1']),
        allowedRoleSlugs: new Set(['member', 'admin']),
        authorizeMutation: () => true,
        store,
      });
      const gateway = new ContainmentGateway({
        store,
        state: mockState(),
        mode: 'staging',
        timeoutMs: 1_000,
        rateLimit: 8,
        identityProvider,
        clock: fixedClock('2026-08-27T12:03:00.000Z'),
      });
      await expect(
        gateway.executeApprovedAction({
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
          approvalId: 'approval-1',
          plan,
          action: plan.actions[0]!,
        }),
      ).resolves.toMatchObject({
        status: 'blocked',
        errorCode: 'PRECONDITION_FAILED',
      });
      expect(mutations).toBe(0);
    } finally {
      store.close();
    }
  });

  it('reconciles a timed-out WorkOS revoke from its bound ledger without a duplicate mutation', async () => {
    const action = {
      ...makePlan().actions[0]!,
      type: 'revoke_session' as const,
      targetId: 'session-1',
      input: {},
    };
    const plan = makePlan({ actions: [action] });
    const { store } = await setup(plan);
    try {
      await approve(store, plan, 'dashboard');
      const gatewayInput = {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action,
      };
      const authorization = await authorizeGatewayAction(store, gatewayInput, {
        mode: 'staging',
        timeoutMs: 1_000,
        rateLimit: 8,
        identityEffectsEnabled: true,
        clock: fixedClock('2026-08-27T12:03:00.000Z'),
      });
      if (authorization.state !== 'claimed') throw new Error('expected containment claim');
      let state: 'active' | 'revoked' = 'active';
      let mutations = 0;
      const provider = new WorkOsIdentityProvider({
        client: {
          userManagement: {
            listOrganizationMemberships: async ({
              userId,
              organizationId,
            }: {
              userId: string;
              organizationId: string;
            }) => ({
              data: [{ userId, organizationId, status: 'active' }],
            }),
            getUser: async () => ({ id: 'subject-1', status: 'active' }),
            listSessions: async () => ({
              data: [
                {
                  id: 'session-1',
                  userId: 'subject-1',
                  organizationId: 'tenant-1',
                  status: state,
                },
              ],
            }),
            revokeSession: async () => {
              mutations += 1;
              await new Promise<void>(resolve => setTimeout(resolve, 10));
              state = 'revoked';
              return { id: 'session-1', userId: 'subject-1', status: state };
            },
          },
          organizations: {
            getMembership: async () => ({}),
            updateMembership: async () => ({}),
          },
        },
        organizationId: 'tenant-1',
        allowedUserIds: new Set(['subject-1']),
        allowedRoleSlugs: new Set(['member']),
        authorizeMutation: () => true,
        store,
        timeoutMs: 1,
        now: () => Date.parse('2026-08-27T12:03:00.000Z'),
      });
      const input = {
        tenantId: 'tenant-1',
        userId: 'subject-1',
        sessionId: 'session-1',
        approvalContext: {
          approvalId: 'approval-1',
          fenceToken: authorization.fenceToken,
          deadline: plan.expiresAt,
        },
        effect: {
          incidentId: 'incident-1',
          planId: 'plan-1',
          actionId: 'action-1',
          targetId: 'session-1',
          idempotencyKey: authorization.idempotencyKey,
        },
      };
      await expect(provider.revokeSession(input)).rejects.toMatchObject({
        code: 'STORAGE_UNAVAILABLE',
        retryable: true,
      });
      await new Promise<void>(resolve => setTimeout(resolve, 15));
      await expect(provider.revokeSession(input)).resolves.toMatchObject({
        status: 'revoked',
      });
      expect(mutations).toBe(1);
      await expect(
        store.execute({
          sql: "SELECT status FROM provider_effect_ledger WHERE provider = 'workos'",
        }),
      ).resolves.toMatchObject({ rows: [{ status: 'succeeded' }] });
    } finally {
      store.close();
    }
  });

  it('reconciles an absent WorkOS session from its signed revocation webhook', async () => {
    const action = {
      ...makePlan().actions[0]!,
      type: 'revoke_session' as const,
      targetId: 'session-1',
      input: {},
    };
    const plan = makePlan({ actions: [action] });
    const { store } = await setup(plan);
    try {
      await approve(store, plan, 'dashboard');
      const authorization = await authorizeGatewayAction(
        store,
        {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
          approvalId: 'approval-1',
          plan,
          action,
        },
        {
          mode: 'staging',
          timeoutMs: 1_000,
          rateLimit: 8,
          identityEffectsEnabled: true,
          clock: fixedClock('2026-08-27T12:03:00.000Z'),
        },
      );
      if (authorization.state !== 'claimed') throw new Error('expected containment claim');
      let revoked = false;
      let mutations = 0;
      let reads = 0;
      const provider = new WorkOsIdentityProvider({
        client: {
          userManagement: {
            listOrganizationMemberships: async ({
              userId,
              organizationId,
            }: {
              userId: string;
              organizationId: string;
            }) => ({
              data: [{ userId, organizationId, status: 'active' }],
            }),
            getUser: async () => ({ id: 'subject-1', status: 'active' }),
            listSessions: async () => {
              reads += 1;
              return {
                data: revoked
                  ? []
                  : [
                      {
                        id: 'session-1',
                        userId: 'subject-1',
                        organizationId: 'tenant-1',
                        status: 'active',
                      },
                    ],
              };
            },
            revokeSession: async () => {
              mutations += 1;
              revoked = true;
              return {
                id: 'session-1',
                userId: 'subject-1',
                status: 'revoked',
              };
            },
          },
          organizations: {
            getMembership: async () => ({}),
            updateMembership: async () => ({}),
          },
        },
        organizationId: 'tenant-1',
        allowedUserIds: new Set(['subject-1']),
        allowedRoleSlugs: new Set(['member']),
        authorizeMutation: () => true,
        store,
        now: () => Date.parse('2026-08-27T12:03:00.000Z'),
      });
      const input = {
        tenantId: 'tenant-1',
        userId: 'subject-1',
        sessionId: 'session-1',
        approvalContext: {
          approvalId: 'approval-1',
          fenceToken: authorization.fenceToken,
          deadline: plan.expiresAt,
        },
        effect: {
          incidentId: 'incident-1',
          planId: 'plan-1',
          actionId: 'action-1',
          targetId: 'session-1',
          idempotencyKey: authorization.idempotencyKey,
        },
      };

      await expect(provider.revokeSession(input)).rejects.toMatchObject({
        code: 'STORAGE_UNAVAILABLE',
        retryable: true,
      });
      await store.execute({
        sql: `INSERT INTO workos_observed_sessions(
          tenant_id, subject_id, session_id, observed_status,
          observed_state_hash, incident_id, source_event_id, observed_at, version
        ) VALUES ('tenant-1', 'subject-1', 'session-1', 'revoked', ?,
          'webhook-incident', 'workos-session-revoked-event',
          '2026-08-27T12:03:01.000Z', 1)`,
        args: ['a'.repeat(64)],
      });

      await expect(provider.revokeSession(input)).resolves.toMatchObject({
        id: 'session-1',
        status: 'revoked',
      });
      expect(mutations).toBe(1);
      expect(reads).toBe(2);
      await expect(
        store.execute({
          sql: "SELECT status FROM provider_effect_ledger WHERE provider = 'workos'",
        }),
      ).resolves.toMatchObject({ rows: [{ status: 'succeeded' }] });
    } finally {
      store.close();
    }
  });

  it('atomically terminalizes the expired sixth WorkOS attempt, action, and ledger', async () => {
    const { store, plan } = await setup();
    try {
      const action = plan.actions[0]!;
      await store.execute({
        sql: `UPDATE containment_actions SET status = 'executing'
          WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
            AND plan_id = ? AND action_id = ?`,
        args: [plan.planId, action.actionId],
      });
      const actionRow = await store.execute({
        sql: `SELECT idempotency_key FROM containment_actions
          WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
            AND plan_id = ? AND action_id = ?`,
        args: [plan.planId, action.actionId],
      });
      const idempotencyKey = String(actionRow.rows[0]!.idempotency_key);
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        const executing = attempt === 6;
        await store.execute({
          sql: `INSERT INTO containment_action_attempts(
            id, tenant_id, incident_id, plan_id, approval_id, action_id,
            idempotency_key, attempt, owner_id, fence_token, status, started_at,
            finished_at, lease_expires_at, verification, error_code
          ) VALUES (?, 'tenant-1', 'incident-1', ?, 'approval-1', ?, ?, ?, 'worker', ?, ?,
            '2026-08-27T12:00:00.000Z', ?, '2026-08-27T12:00:01.000Z', 'not_run', ?)`,
          args: [
            `expired-attempt-${attempt}`,
            plan.planId,
            action.actionId,
            idempotencyKey,
            attempt,
            `expired-fence-${attempt}`,
            executing ? 'executing' : 'timed_out',
            executing ? null : '2026-08-27T12:00:01.000Z',
            executing ? null : 'PROVIDER_TIMEOUT',
          ],
        });
      }
      await store.execute({
        sql: `INSERT INTO provider_effect_ledger(
          provider, idempotency_key, tenant_id, incident_id, operation, plan_id,
          action_id, target_id, status, fence_token, claimed_at
        ) VALUES ('workos', ?, 'tenant-1', 'incident-1', 'revoke_session', ?, ?, ?,
          'uncertain', 'expired-fence-6', '2026-08-27T12:00:00.000Z')`,
        args: [idempotencyKey, plan.planId, action.actionId, action.targetId],
      });
      let now = '2026-08-27T12:00:00.000Z';
      const dispatcher = new ApprovalRecoveryWorker({
        store,
        provider: new LocalIncidentProvider(),
        reconcileApprovalRun: async () => 'completed',
        clock: { now: () => now },
      });
      await expect(dispatcher.runOnce()).resolves.toMatchObject({
        containmentRetried: 0,
      });
      now = '2026-08-27T12:10:00.000Z';
      await expect(dispatcher.runOnce()).resolves.toMatchObject({
        containmentRetried: 1,
      });
      const terminal = await store.execute({
        sql: `SELECT
          (SELECT status FROM provider_effect_ledger WHERE provider = 'workos') AS ledger,
          (SELECT status FROM containment_actions WHERE action_id = ?) AS action,
          (SELECT status FROM containment_action_attempts WHERE attempt = 6) AS attempt`,
        args: [action.actionId],
      });
      expect(terminal.rows[0]).toEqual({
        ledger: 'failed',
        action: 'failed',
        attempt: 'failed',
      });
      const restarted = new ApprovalRecoveryWorker({
        store,
        provider: new LocalIncidentProvider(),
        reconcileApprovalRun: async () => 'completed',
        clock: { now: () => now },
      });
      await expect(restarted.runOnce()).resolves.toMatchObject({
        containmentRetried: 0,
      });
    } finally {
      store.close();
    }
  });

  it('reconciles an eventually visible WorkOS effect after three fenced attempts without mutating twice', async () => {
    const action = {
      ...makePlan().actions[0]!,
      type: 'revoke_session' as const,
      targetId: 'session-1',
      input: {},
    };
    const plan = makePlan({ actions: [action] });
    const { store } = await setup(plan);
    try {
      await approve(store, plan, 'dashboard');
      let remoteApplied = false;
      let reads = 0;
      let mutations = 0;
      const identityProvider = new WorkOsIdentityProvider({
        client: {
          userManagement: {
            listOrganizationMemberships: async ({
              userId,
              organizationId,
            }: {
              userId: string;
              organizationId: string;
            }) => ({
              data: [{ userId, organizationId, status: 'active' }],
            }),
            getUser: async () => ({ id: 'subject-1' }),
            // The remote write is accepted at once but is intentionally
            // invisible through the first four reads (one initial preflight,
            // then one readback for each of the three budgeted attempts).
            // Reconciliation deliberately skips repeated preflight reads.
            listSessions: async () => {
              reads += 1;
              const visible = remoteApplied && reads > 4;
              return {
                data: [
                  {
                    id: 'session-1',
                    userId: 'subject-1',
                    organizationId: 'tenant-1',
                    status: visible ? 'revoked' : 'active',
                  },
                ],
              };
            },
            revokeSession: async () => {
              mutations += 1;
              remoteApplied = true;
              return {
                id: 'session-1',
                userId: 'subject-1',
                status: 'revoked',
              };
            },
          },
          organizations: {
            getMembership: async () => ({}),
            updateMembership: async () => ({}),
          },
        },
        organizationId: 'tenant-1',
        allowedUserIds: new Set(['subject-1']),
        allowedRoleSlugs: new Set(['member']),
        authorizeMutation: () => true,
        store,
        now: () => Date.parse('2026-08-27T12:03:00.000Z'),
        timeoutMs: 1_000,
      });
      const gateway = new ContainmentGateway({
        store,
        state: mockState(),
        mode: 'staging',
        timeoutMs: 1_000,
        rateLimit: 8,
        identityProvider,
        clock: fixedClock('2026-08-27T12:03:00.000Z'),
      });
      const input = {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action,
      };
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await expect(gateway.executeApprovedAction(input)).resolves.toMatchObject({ status: 'timed_out' });
      }
      await expect(gateway.executeApprovedAction(input)).resolves.toMatchObject({
        status: 'completed',
        verification: 'verified',
      });
      expect(mutations).toBe(1);
      await expect(
        store.execute({
          sql: `SELECT status FROM provider_effect_ledger WHERE provider = 'workos'`,
        }),
      ).resolves.toMatchObject({ rows: [{ status: 'succeeded' }] });
      await expect(
        store.execute({
          sql: `SELECT attempt, status FROM containment_action_attempts ORDER BY attempt`,
        }),
      ).resolves.toMatchObject({
        rows: [
          { attempt: 1, status: 'timed_out' },
          { attempt: 2, status: 'timed_out' },
          { attempt: 3, status: 'timed_out' },
          { attempt: 4, status: 'completed' },
        ],
      });
    } finally {
      store.close();
    }
  });

  it('terminally bounds invisible WorkOS reconciliation without issuing another mutation', async () => {
    const action = {
      ...makePlan().actions[0]!,
      type: 'revoke_session' as const,
      targetId: 'session-1',
      input: {},
    };
    const plan = makePlan({ actions: [action] });
    const { store } = await setup(plan);
    try {
      await approve(store, plan, 'dashboard');
      let mutations = 0;
      const identityProvider = new WorkOsIdentityProvider({
        client: {
          userManagement: {
            listOrganizationMemberships: async ({
              userId,
              organizationId,
            }: {
              userId: string;
              organizationId: string;
            }) => ({
              data: [{ userId, organizationId, status: 'active' }],
            }),
            getUser: async () => ({ id: 'subject-1' }),
            // The remote state never becomes observable during the bounded
            // reconciliation window.
            listSessions: async () => ({
              data: [
                {
                  id: 'session-1',
                  userId: 'subject-1',
                  organizationId: 'tenant-1',
                  status: 'active',
                },
              ],
            }),
            revokeSession: async () => {
              mutations += 1;
              return {
                id: 'session-1',
                userId: 'subject-1',
                status: 'revoked',
              };
            },
          },
          organizations: {
            getMembership: async () => ({}),
            updateMembership: async () => ({}),
          },
        },
        organizationId: 'tenant-1',
        allowedUserIds: new Set(['subject-1']),
        allowedRoleSlugs: new Set(['member']),
        authorizeMutation: () => true,
        store,
        now: () => Date.parse('2026-08-27T12:03:00.000Z'),
        timeoutMs: 1_000,
      });
      const gateway = new ContainmentGateway({
        store,
        state: mockState(),
        mode: 'staging',
        timeoutMs: 1_000,
        rateLimit: 8,
        identityProvider,
        clock: fixedClock('2026-08-27T12:03:00.000Z'),
      });
      const input = {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action,
      };
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await expect(gateway.executeApprovedAction(input)).resolves.toMatchObject({ status: 'timed_out' });
      }
      await expect(gateway.executeApprovedAction(input)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      expect(mutations).toBe(1);
      await expect(
        store.execute({
          sql: `SELECT status, completed_at IS NOT NULL AS terminal FROM provider_effect_ledger WHERE provider = 'workos'`,
        }),
      ).resolves.toMatchObject({ rows: [{ status: 'failed', terminal: 1 }] });
      await expect(
        store.execute({
          sql: `SELECT outcome, reason_code FROM containment_gateway_audit ORDER BY occurred_at DESC LIMIT 1`,
        }),
      ).resolves.toMatchObject({
        rows: [{ outcome: 'rate_limited', reason_code: 'RATE_LIMITED' }],
      });
    } finally {
      store.close();
    }
  });

  it('fences a timed-out mock call before it can apply a late effect', async () => {
    const { store, plan } = await setup();
    try {
      await approve(store, plan);
      const state = mockState();
      state.roles.set('subject-1', 'admin');
      state.delayMs = 25;
      const gateway = new ContainmentGateway({
        store,
        state,
        mode: 'local',
        timeoutMs: 5,
        rateLimit: 8,
        clock: fixedClock('2026-08-27T12:03:00.000Z'),
      });
      await expect(
        gateway.executeApprovedAction({
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
          approvalId: 'approval-1',
          plan,
          action: plan.actions[0]!,
        }),
      ).resolves.toMatchObject({
        status: 'timed_out',
        errorCode: 'PROVIDER_TIMEOUT',
      });
      await new Promise<void>(resolve => setTimeout(resolve, 35));
      expect(state.roles.get('subject-1')).toBe('admin');
      expect(state.calls.get(plan.actions[0]!.actionId)).toBeUndefined();
    } finally {
      store.close();
    }
  });

  it('lets a second gateway reclaim an expired lease while fencing the old owner', async () => {
    const { store, plan } = await setup();
    try {
      await approve(store, plan);
      const state = mockState();
      state.roles.set('subject-1', 'admin');
      state.delayMs = 50;
      let now = '2026-08-27T12:03:00.000Z';
      const clock: Clock = { now: () => now };
      const input = {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action: plan.actions[0]!,
      };
      const oldOwner = new ContainmentGateway({
        store,
        state,
        mode: 'local',
        timeoutMs: 20,
        rateLimit: 8,
        clock,
      }).executeApprovedAction(input);
      await new Promise<void>(resolve => setTimeout(resolve, 10));
      now = '2026-08-27T12:04:00.000Z';
      const successor = new ContainmentGateway({
        store,
        state,
        mode: 'local',
        timeoutMs: 200,
        rateLimit: 8,
        clock,
      }).executeApprovedAction(input);
      const results = await Promise.allSettled([oldOwner, successor]);
      expect(results[1]).toMatchObject({
        status: 'fulfilled',
        value: { status: 'completed', verification: 'verified' },
      });
      expect(state.calls.get(plan.actions[0]!.actionId)).toBe(1);
      const attempts = await store.execute({
        sql: `SELECT attempt, status FROM containment_action_attempts
          ORDER BY attempt`,
      });
      expect(attempts.rows).toEqual([
        { attempt: 1, status: 'failed' },
        { attempt: 2, status: 'completed' },
      ]);
    } finally {
      store.close();
    }
  });

  it('reconciles a post-effect crash after restart with a distinct mock state', async () => {
    const { store, plan } = await setup();
    try {
      await approve(store, plan);
      let now = '2026-08-27T12:03:00.000Z';
      const clock: Clock = { now: () => now };
      const state = mockState();
      state.roles.set('subject-1', 'admin');
      const crashAfterEffectStore: OperationalStore = {
        execute: statement => store.execute(statement),
        transaction: operation =>
          store.transaction(tx =>
            operation({
              execute: async statement => {
                if (statement.sql.includes('UPDATE containment_action_attempts SET status = ?, finished_at')) {
                  throw new Error('process crashed before finish');
                }
                return tx.execute(statement);
              },
              batch: statements => tx.batch(statements),
            }),
          ),
        close: () => {},
      };
      const input = {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action: plan.actions[0]!,
      };
      await expect(
        new ContainmentGateway({
          store: crashAfterEffectStore,
          state,
          mode: 'local',
          timeoutMs: 1_000,
          rateLimit: 8,
          clock,
        }).executeApprovedAction(input),
      ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
      expect(state.calls.get(plan.actions[0]!.actionId)).toBe(1);
      expect(state.roles.get('subject-1')).toBe('member');
      const crashed = await store.execute({
        sql: `SELECT status, verification FROM containment_action_attempts
          ORDER BY attempt`,
      });
      expect(crashed.rows).toEqual([{ status: 'executing', verification: 'not_run' }]);
      now = '2026-08-27T12:03:03.000Z';
      const restartedState = mockState();
      await expect(
        new ContainmentGateway({
          store,
          state: restartedState,
          mode: 'local',
          timeoutMs: 1_000,
          rateLimit: 8,
          clock,
        }).executeApprovedAction(input),
      ).resolves.toMatchObject({
        status: 'completed',
        verification: 'verified',
      });
      expect(state.calls.get(plan.actions[0]!.actionId)).toBe(1);
      expect(restartedState.calls.get(plan.actions[0]!.actionId)).toBeUndefined();
      const effect = await store.execute({
        sql: `SELECT attempt, action_type, target_id, provider_ref
          FROM local_containment_effects`,
      });
      expect(effect.rows).toEqual([
        {
          attempt: 1,
          action_type: plan.actions[0]!.type,
          target_id: plan.actions[0]!.targetId,
          provider_ref: `local-action-${plan.actions[0]!.actionId}`,
        },
      ]);
      await expect(
        store.execute({
          sql: `UPDATE local_containment_effects SET provider_ref = 'tampered'
            WHERE action_id = ?`,
          args: [plan.actions[0]!.actionId],
        }),
      ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
      const recovered = await store.execute({
        sql: `SELECT attempt, status, verification FROM containment_action_attempts
          ORDER BY attempt`,
      });
      expect(recovered.rows).toEqual([{ attempt: 1, status: 'completed', verification: 'verified' }]);
    } finally {
      store.close();
    }
  });

  it('validates contained finalization before closing and replays without a closed-to-closed transition', async () => {
    const firstAction = makePlan().actions[0]!;
    const secondAction = {
      ...firstAction,
      actionId: 'action-2',
      type: 'revoke_session' as const,
      targetId: 'session-1',
      input: {},
    };
    const plan = makePlan({ actions: [firstAction, secondAction] });
    const { database, store } = await setup(plan);
    try {
      const approved = await approve(store, plan);
      await transitionIncident(
        store,
        {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          expectedVersion: 3,
          to: 'containing',
          runId: 'run-1',
          correlationId: 'correlation-1',
        },
        {
          clock: fixedClock('2026-08-27T12:02:30.000Z'),
          ids: sequenceIdGenerator(['timeline-containing', 'outbox-containing']),
        },
      );
      const state = mockState();
      state.roles.set('subject-1', 'admin');
      state.sessions.set('session-1', 'active');
      const gateway = gatewayFor(store, state);
      const firstOutcome = await gateway.executeApprovedAction({
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action: firstAction,
      });
      const secondOutcome = await gateway.executeApprovedAction({
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action: secondAction,
      });
      await recordContainmentOutcome(
        store,
        {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
          correlationId: 'correlation-1',
          approvalId: 'approval-1',
          expectedVersion: 4,
          status: 'contained',
          partial: false,
          completedCount: 2,
          failedCount: 0,
        },
        {
          clock: fixedClock('2026-08-27T12:03:30.000Z'),
          ids: sequenceIdGenerator(['timeline-contained', 'outbox-contained']),
        },
      );
      const triage = await readTriagePayload(store);
      const inputData = {
        status: 'containment-succeeded' as const,
        decision: triage.decision,
        summary: triage.summary,
        plan,
        authoritative: {
          approvalId: approved.decision.approvalId,
          planId: approved.decision.planId,
          incidentId: approved.decision.incidentId,
          tenantId: approved.decision.tenantId,
          workflowRunId: 'run-1',
          planHashVersion: approved.decision.planHashVersion,
          planHash: approved.decision.planHash,
          decision: approved.decision.decision,
          decidedBy: approved.decision.decidedBy,
          decidedByRole: approved.decision.decidedByRole,
          decidedAt: approved.decision.decidedAt,
          expiresAt: plan.expiresAt,
        },
        workflowRunId: 'run-1',
        correlationId: 'correlation-1',
        outcomes: [firstOutcome, secondOutcome],
      };
      const step = createFinalizeIncidentStep({
        openStore: () => database.createStore(),
        clock: fixedClock('2026-08-27T12:04:00.000Z'),
        ids: sequenceIdGenerator(['timeline-closed', 'outbox-closed']),
      });
      const execute = step.execute!;
      const eventsBeforeFirstValidation = await store.execute({
        sql: `SELECT count(*) AS count FROM timeline_events
          WHERE type = 'incident.status_changed'`,
      });
      const [racedPlan] = schemaValidPlanTamperings(plan).filter(
        candidate => candidate.actions[0]?.targetId !== plan.actions[0]?.targetId,
      );
      let raceInjected = false;
      const raceStep = createFinalizeIncidentStep({
        openStore: () => {
          const delegate = database.createStore();
          return {
            execute: statement => delegate.execute(statement),
            transaction: async operation => {
              if (!raceInjected) {
                raceInjected = true;
                await store.execute({
                  sql: `UPDATE containment_plans SET plan_json = ?
                    WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
                      AND id = 'plan-1'`,
                  args: [JSON.stringify(racedPlan)],
                });
              }
              return delegate.transaction(operation);
            },
            close: () => delegate.close(),
          };
        },
        clock: fixedClock('2026-08-27T12:04:00.000Z'),
        ids: sequenceIdGenerator(['timeline-raced-closed', 'outbox-raced-closed']),
      });
      await expect(raceStep.execute!({ inputData } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(raceInjected).toBe(true);
      await store.execute({
        sql: `UPDATE containment_plans SET plan_json = ?
          WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
            AND id = 'plan-1'`,
        args: [JSON.stringify(plan)],
      });
      for (const [field, value] of [
        ['approvalId', 'different-approval'],
        ['tenantId', 'different-tenant'],
        ['incidentId', 'different-incident'],
        ['workflowRunId', 'different-run'],
        ['planId', 'different-plan'],
        ['planHash', '0'.repeat(64)],
        ['decision', 'rejected'],
        ['decidedBy', 'different-manager'],
        ['decidedAt', '2026-08-27T12:02:01.000Z'],
        ['expiresAt', '2026-08-27T12:16:01.000Z'],
      ] as const) {
        const divergent = ContainmentExecutionResultSchema.parse({
          ...inputData,
          authoritative: { ...inputData.authoritative, [field]: value },
        });
        await expect(execute({ inputData: divergent } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      }
      for (const [field, value] of [
        ['workflowRunId', 'different-run'],
        ['correlationId', 'different-correlation'],
      ] as const) {
        const divergent = ContainmentExecutionResultSchema.parse({
          ...inputData,
          [field]: value,
        });
        await expect(execute({ inputData: divergent } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      }
      for (const tamperedPlan of schemaValidPlanTamperings(plan)) {
        const divergent = ContainmentExecutionResultSchema.parse({
          ...inputData,
          plan: tamperedPlan,
        });
        await expect(execute({ inputData: divergent } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      }
      const firstDuplicateOutcome = ContainmentExecutionResultSchema.parse({
        ...inputData,
        outcomes: [firstOutcome, firstOutcome],
      });
      await expect(execute({ inputData: firstDuplicateOutcome } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      const firstInvertedOutcomes = ContainmentExecutionResultSchema.parse({
        ...inputData,
        outcomes: [secondOutcome, firstOutcome],
      });
      await expect(execute({ inputData: firstInvertedOutcomes } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      const stateAfterFirstDivergences = await store.execute({
        sql: `SELECT status, closed_at FROM incidents
          WHERE tenant_id = 'tenant-1' AND id = 'incident-1'`,
      });
      const eventsAfterFirstDivergences = await store.execute({
        sql: `SELECT count(*) AS count FROM timeline_events
          WHERE type = 'incident.status_changed'`,
      });
      expect(stateAfterFirstDivergences.rows[0]).toEqual({
        status: 'contained',
        closed_at: null,
      });
      expect(eventsAfterFirstDivergences.rows[0]?.count).toBe(eventsBeforeFirstValidation.rows[0]?.count);
      const first = await execute({ inputData } as never);
      const eventsAfterFirst = await store.execute({
        sql: `SELECT count(*) AS count FROM timeline_events
          WHERE type = 'incident.status_changed'`,
      });
      const replay = await execute({ inputData } as never);
      const eventsAfterReplay = await store.execute({
        sql: `SELECT count(*) AS count FROM timeline_events
          WHERE type = 'incident.status_changed'`,
      });
      expect(replay).toEqual(first);
      expect(replay).toMatchObject({ status: 'contained' });
      expect(eventsAfterReplay.rows[0]?.count).toBe(eventsAfterFirst.rows[0]?.count);
      for (const [field, value] of [
        ['approvalId', 'different-approval'],
        ['tenantId', 'different-tenant'],
        ['incidentId', 'different-incident'],
        ['workflowRunId', 'different-run'],
        ['planId', 'different-plan'],
        ['planHash', '0'.repeat(64)],
        ['decision', 'rejected'],
        ['decidedBy', 'different-manager'],
        ['decidedAt', '2026-08-27T12:02:01.000Z'],
        ['expiresAt', '2026-08-27T12:16:01.000Z'],
      ] as const) {
        const divergent = ContainmentExecutionResultSchema.parse({
          ...inputData,
          authoritative: { ...inputData.authoritative, [field]: value },
        });
        await expect(execute({ inputData: divergent } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      }
      for (const [field, value] of [
        ['workflowRunId', 'different-run'],
        ['correlationId', 'different-correlation'],
      ] as const) {
        const divergent = ContainmentExecutionResultSchema.parse({
          ...inputData,
          [field]: value,
        });
        await expect(execute({ inputData: divergent } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      }
      for (const tamperedPlan of schemaValidPlanTamperings(plan)) {
        const divergent = ContainmentExecutionResultSchema.parse({
          ...inputData,
          plan: tamperedPlan,
        });
        await expect(execute({ inputData: divergent } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      }
      const duplicateOutcome = ContainmentExecutionResultSchema.parse({
        ...inputData,
        outcomes: [firstOutcome, firstOutcome],
      });
      await expect(execute({ inputData: duplicateOutcome } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      const invertedOutcomes = ContainmentExecutionResultSchema.parse({
        ...inputData,
        outcomes: [secondOutcome, firstOutcome],
      });
      await expect(execute({ inputData: invertedOutcomes } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      await store.execute({
        sql: `UPDATE incidents SET closed_at = '2026-08-27T12:04:01.000Z'
          WHERE tenant_id = 'tenant-1' AND id = 'incident-1'`,
      });
      await expect(execute({ inputData } as never)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      const eventsAfterDivergence = await store.execute({
        sql: `SELECT count(*) AS count FROM timeline_events
          WHERE type = 'incident.status_changed'`,
      });
      expect(eventsAfterDivergence.rows[0]?.count).toBe(eventsAfterReplay.rows[0]?.count);
    } finally {
      store.close();
    }
  });

  it('validates rejected finalization before closing and replays the same terminal result', async () => {
    const { database, store, plan } = await setup();
    try {
      const rejected = await reject(store, plan);
      const triage = await readTriagePayload(store);
      const inputData = {
        status: 'rejected' as const,
        decision: triage.decision,
        summary: triage.summary,
        plan,
        authoritative: {
          approvalId: rejected.decision.approvalId,
          planId: rejected.decision.planId,
          incidentId: rejected.decision.incidentId,
          tenantId: rejected.decision.tenantId,
          workflowRunId: 'run-1',
          planHashVersion: rejected.decision.planHashVersion,
          planHash: rejected.decision.planHash,
          decision: rejected.decision.decision,
          decidedBy: rejected.decision.decidedBy,
          decidedByRole: rejected.decision.decidedByRole,
          decidedAt: rejected.decision.decidedAt,
          expiresAt: plan.expiresAt,
        },
        workflowRunId: 'run-1',
        correlationId: 'correlation-1',
      };
      const step = createFinalizeIncidentStep({
        openStore: () => database.createStore(),
        clock: fixedClock('2026-08-27T12:04:00.000Z'),
        ids: sequenceIdGenerator(['timeline-closed', 'outbox-closed']),
      });
      const execute = step.execute!;
      const eventsBeforeFirstValidation = await store.execute({
        sql: `SELECT count(*) AS count FROM timeline_events
          WHERE type = 'incident.status_changed'`,
      });
      const [qaTamperedPlan] = schemaValidPlanTamperings(plan).filter(
        candidate => candidate.actions[0]?.targetId !== plan.actions[0]?.targetId,
      );
      const qaRejectedDivergence = ContainmentExecutionResultSchema.parse({
        ...inputData,
        plan: qaTamperedPlan,
        authoritative: {
          ...inputData.authoritative,
          approvalId: 'forged-approval',
        },
      });
      await expect(execute({ inputData: qaRejectedDivergence } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      for (const [field, value] of [
        ['workflowRunId', 'different-run'],
        ['correlationId', 'different-correlation'],
      ] as const) {
        const divergent = ContainmentExecutionResultSchema.parse({
          ...inputData,
          [field]: value,
        });
        await expect(execute({ inputData: divergent } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      }
      for (const [field, value] of [
        ['approvalId', 'different-approval'],
        ['tenantId', 'different-tenant'],
        ['incidentId', 'different-incident'],
        ['workflowRunId', 'different-run'],
        ['planId', 'different-plan'],
        ['planHash', '0'.repeat(64)],
        ['decision', 'approved'],
        ['decidedBy', 'different-manager'],
        ['decidedAt', '2026-08-27T12:02:01.000Z'],
        ['expiresAt', '2026-08-27T12:16:01.000Z'],
      ] as const) {
        const divergent = ContainmentExecutionResultSchema.parse({
          ...inputData,
          authoritative: { ...inputData.authoritative, [field]: value },
        });
        await expect(execute({ inputData: divergent } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      }
      for (const tamperedPlan of schemaValidPlanTamperings(plan)) {
        const divergent = ContainmentExecutionResultSchema.parse({
          ...inputData,
          plan: tamperedPlan,
        });
        await expect(execute({ inputData: divergent } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      }
      const stateAfterFirstDivergences = await store.execute({
        sql: `SELECT status, closed_at FROM incidents
          WHERE tenant_id = 'tenant-1' AND id = 'incident-1'`,
      });
      const eventsAfterFirstDivergences = await store.execute({
        sql: `SELECT count(*) AS count FROM timeline_events
          WHERE type = 'incident.status_changed'`,
      });
      expect(stateAfterFirstDivergences.rows[0]).toEqual({
        status: 'rejected',
        closed_at: null,
      });
      expect(eventsAfterFirstDivergences.rows[0]?.count).toBe(eventsBeforeFirstValidation.rows[0]?.count);
      const first = await execute({ inputData } as never);
      const eventsAfterFirst = await store.execute({
        sql: `SELECT count(*) AS count FROM timeline_events
          WHERE type = 'incident.status_changed'`,
      });
      const replay = await execute({ inputData } as never);
      const eventsAfterReplay = await store.execute({
        sql: `SELECT count(*) AS count FROM timeline_events
          WHERE type = 'incident.status_changed'`,
      });
      expect(replay).toEqual(first);
      expect(replay).toEqual({
        status: 'rejected',
        incidentId: 'incident-1',
        approvalId: 'approval-1',
      });
      expect(eventsAfterReplay.rows[0]?.count).toBe(eventsAfterFirst.rows[0]?.count);
      for (const [field, value] of [
        ['workflowRunId', 'different-run'],
        ['correlationId', 'different-correlation'],
      ] as const) {
        const divergent = ContainmentExecutionResultSchema.parse({
          ...inputData,
          [field]: value,
        });
        await expect(execute({ inputData: divergent } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      }
      for (const [field, value] of [
        ['approvalId', 'different-approval'],
        ['tenantId', 'different-tenant'],
        ['incidentId', 'different-incident'],
        ['workflowRunId', 'different-run'],
        ['planId', 'different-plan'],
        ['planHash', '0'.repeat(64)],
        ['decision', 'approved'],
        ['decidedBy', 'different-manager'],
        ['decidedAt', '2026-08-27T12:02:01.000Z'],
        ['expiresAt', '2026-08-27T12:16:01.000Z'],
      ] as const) {
        const divergent = ContainmentExecutionResultSchema.parse({
          ...inputData,
          authoritative: { ...inputData.authoritative, [field]: value },
        });
        await expect(execute({ inputData: divergent } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      }
      for (const tamperedPlan of schemaValidPlanTamperings(plan)) {
        const divergent = ContainmentExecutionResultSchema.parse({
          ...inputData,
          plan: tamperedPlan,
        });
        await expect(execute({ inputData: divergent } as never)).rejects.toMatchObject({ code: 'CONFLICT' });
      }
      await store.execute({
        sql: `UPDATE incidents SET closed_at = '2026-08-27T12:04:01.000Z'
          WHERE tenant_id = 'tenant-1' AND id = 'incident-1'`,
      });
      await expect(execute({ inputData } as never)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      const eventsAfterDivergence = await store.execute({
        sql: `SELECT count(*) AS count FROM timeline_events
          WHERE type = 'incident.status_changed'`,
      });
      expect(eventsAfterDivergence.rows[0]?.count).toBe(eventsAfterReplay.rows[0]?.count);
    } finally {
      store.close();
    }
  });

  it('stops on the first failure and retries only failed/pending actions', async () => {
    const first = makePlan().actions[0]!;
    const second = {
      ...first,
      actionId: 'action-2',
      type: 'revoke_session' as const,
      targetId: 'session-1',
      input: {},
    };
    const plan = makePlan({ actions: [first, second] });
    const { store } = await setup(plan);
    try {
      await approve(store, plan);
      const state = mockState();
      state.roles.set('subject-1', 'admin');
      state.sessions.set('session-1', 'active');
      state.failActions = new Set([second.actionId]);
      const gateway = gatewayFor(store, state);
      expect(
        (
          await gateway.executeApprovedAction({
            tenantId: 'tenant-1',
            incidentId: 'incident-1',
            workflowRunId: 'run-1',
            approvalId: 'approval-1',
            plan,
            action: first,
          })
        ).status,
      ).toBe('completed');
      expect(
        (
          await gateway.executeApprovedAction({
            tenantId: 'tenant-1',
            incidentId: 'incident-1',
            workflowRunId: 'run-1',
            approvalId: 'approval-1',
            plan,
            action: second,
          })
        ).status,
      ).toBe('failed');
      state.failActions.clear();
      await gateway.executeApprovedAction({
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action: first,
      });
      await gateway.executeApprovedAction({
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action: second,
      });
      expect(state.calls.get(first.actionId)).toBe(1);
      expect(state.calls.get(second.actionId)).toBe(2);
      expect(state.roles.get('subject-1')).toBe('member');
      expect(state.sessions.get('session-1')).toBe('revoked');
    } finally {
      store.close();
    }
  });

  it('enforces plan order in the gateway and audits the blocked successor', async () => {
    const first = makePlan().actions[0]!;
    const second = {
      ...first,
      actionId: 'action-2',
      type: 'revoke_session' as const,
      targetId: 'session-1',
      input: {},
    };
    const plan = makePlan({ actions: [first, second] });
    const { store } = await setup(plan);
    try {
      await approve(store, plan);
      const state = mockState();
      state.sessions.set('session-1', 'active');
      await expect(
        gatewayFor(store, state).executeApprovedAction({
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
          approvalId: 'approval-1',
          plan,
          action: second,
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(state.calls.size).toBe(0);
      const audit = await store.execute({
        sql: `SELECT outcome, reason_code FROM containment_gateway_audit
          ORDER BY occurred_at DESC LIMIT 1`,
      });
      expect(audit.rows[0]).toEqual({
        outcome: 'blocked',
        reason_code: 'PREDECESSOR_INCOMPLETE',
      });
    } finally {
      store.close();
    }
  });

  it('caps failed action retries before a fourth effect can run', async () => {
    const plan = makePlan();
    const action = plan.actions[0]!;
    const { store } = await setup(plan);
    try {
      await approve(store, plan);
      const state = mockState();
      state.roles.set('subject-1', 'admin');
      state.failActions = new Set([action.actionId]);
      const gateway = gatewayFor(store, state);
      const input = {
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action,
      } as const;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await expect(gateway.executeApprovedAction(input)).resolves.toMatchObject({
          status: 'failed',
        });
      }
      await expect(gateway.executeApprovedAction(input)).rejects.toMatchObject({
        code: 'CONFLICT',
      });

      expect(state.calls.get(action.actionId)).toBe(3);
      const attempts = await store.execute({
        sql: `SELECT count(*) AS count FROM containment_action_attempts
          WHERE action_id = ?`,
        args: [action.actionId],
      });
      expect(Number(attempts.rows[0]?.count)).toBe(3);
      const audit = await store.execute({
        sql: `SELECT outcome, reason_code FROM containment_gateway_audit
          ORDER BY rowid DESC LIMIT 1`,
      });
      expect(audit.rows[0]).toEqual({
        outcome: 'rate_limited',
        reason_code: 'RATE_LIMITED',
      });
    } finally {
      store.close();
    }
  });

  it('shares the tenant rate-limit budget across incidents for the same action type', async () => {
    const { store, plan } = await setup();
    try {
      await approve(store, plan);
      const second = await setupAdditionalApprovedIncident(store, 'restore_previous_role');
      const state = mockState();
      state.roles.set('subject-1', 'admin');
      state.roles.set('subject-2', 'admin');
      const gateway = new ContainmentGateway({
        store,
        state,
        mode: 'local',
        timeoutMs: 1_000,
        rateLimit: 1,
        clock: fixedClock('2026-08-27T12:03:00.000Z'),
      });

      await expect(
        gateway.executeApprovedAction({
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
          approvalId: 'approval-1',
          plan,
          action: plan.actions[0]!,
        }),
      ).resolves.toMatchObject({ status: 'completed' });
      await expect(
        gateway.executeApprovedAction({
          tenantId: 'tenant-1',
          incidentId: 'incident-2',
          workflowRunId: 'run-2',
          approvalId: 'approval-2',
          plan: second.plan,
          action: second.action,
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });

      expect(state.calls.get(plan.actions[0]!.actionId)).toBe(1);
      expect(state.calls.get(second.action.actionId)).toBeUndefined();
      const audit = await store.execute({
        sql: `SELECT claimed_action_id, outcome, reason_code
          FROM containment_gateway_audit ORDER BY rowid DESC LIMIT 1`,
      });
      expect(audit.rows[0]).toEqual({
        claimed_action_id: second.action.actionId,
        outcome: 'rate_limited',
        reason_code: 'RATE_LIMITED',
      });
    } finally {
      store.close();
    }
  });

  it('keeps independent tenant rate-limit budgets for distinct action types', async () => {
    const { store, plan } = await setup();
    try {
      await approve(store, plan);
      const second = await setupAdditionalApprovedIncident(store, 'revoke_session');
      const state = mockState();
      state.roles.set('subject-1', 'admin');
      state.sessions.set('session-2', 'active');
      const gateway = new ContainmentGateway({
        store,
        state,
        mode: 'local',
        timeoutMs: 1_000,
        rateLimit: 1,
        clock: fixedClock('2026-08-27T12:03:00.000Z'),
      });

      await expect(
        gateway.executeApprovedAction({
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
          approvalId: 'approval-1',
          plan,
          action: plan.actions[0]!,
        }),
      ).resolves.toMatchObject({ status: 'completed' });
      await expect(
        gateway.executeApprovedAction({
          tenantId: 'tenant-1',
          incidentId: 'incident-2',
          workflowRunId: 'run-2',
          approvalId: 'approval-2',
          plan: second.plan,
          action: second.action,
        }),
      ).resolves.toMatchObject({ status: 'completed' });

      expect(state.calls.get(plan.actions[0]!.actionId)).toBe(1);
      expect(state.calls.get(second.action.actionId)).toBe(1);
    } finally {
      store.close();
    }
  });

  it('recovers an aggregate failed incident without repeating verified actions', async () => {
    const first = makePlan().actions[0]!;
    const second = {
      ...first,
      actionId: 'action-2',
      type: 'revoke_session' as const,
      targetId: 'session-1',
      input: {},
    };
    const plan = makePlan({ actions: [first, second] });
    const { store } = await setup(plan);
    try {
      await approve(store, plan);
      await transitionIncident(
        store,
        {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          expectedVersion: 3,
          to: 'containing',
          runId: 'run-1',
          correlationId: 'correlation-1',
          causationId: 'approval-1',
        },
        {
          clock: fixedClock('2026-08-27T12:03:00.000Z'),
          ids: sequenceIdGenerator(['containing-timeline', 'containing-outbox']),
        },
      );
      const state = mockState();
      state.roles.set('subject-1', 'admin');
      state.sessions.set('session-1', 'active');
      state.failActions = new Set([second.actionId]);
      const gateway = gatewayFor(store, state);
      await gateway.executeApprovedAction({
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action: first,
      });
      await gateway.executeApprovedAction({
        tenantId: 'tenant-1',
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        plan,
        action: second,
      });
      await recordContainmentOutcome(
        store,
        {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'run-1',
          correlationId: 'correlation-1',
          approvalId: 'approval-1',
          expectedVersion: 4,
          status: 'failed',
          partial: true,
          completedCount: 1,
          failedCount: 1,
        },
        {
          clock: fixedClock('2026-08-27T12:03:00.000Z'),
          ids: sequenceIdGenerator(['failed-timeline', 'failed-outbox']),
        },
      );
      state.failActions.clear();
      await expect(
        retryPartialContainment(
          store,
          {
            tenantId: 'tenant-1',
            incidentId: 'incident-1',
            workflowRunId: 'run-1',
            approvalId: 'approval-1',
            correlationId: 'retry-correlation-1',
            state,
            mode: 'local',
            timeoutMs: 1_000,
            rateLimit: 8,
          },
          { clock: fixedClock('2026-08-27T12:04:00.000Z') },
        ),
      ).resolves.toMatchObject({ status: 'contained' });
      expect(state.calls.get(first.actionId)).toBe(1);
      expect(state.calls.get(second.actionId)).toBe(2);
      const final = await store.execute({
        sql: "SELECT status FROM incidents WHERE id = 'incident-1'",
      });
      expect(final.rows[0]?.status).toBe('closed');
    } finally {
      store.close();
    }
  });

  it('rechecks partial-recovery terminal readiness inside the close transaction', async () => {
    const first = makePlan().actions[0]!;
    const second = {
      ...first,
      actionId: 'action-2',
      type: 'revoke_session' as const,
      targetId: 'session-1',
      input: {},
    };
    const plan = makePlan({ actions: [first, second] });
    const { store } = await setup(plan);
    try {
      const prepared = await preparePartialContainmentFailure(store, plan);
      let terminalReadbackSeen = false;
      let raceInjected = false;
      const tamperedPlan = {
        ...plan,
        actions: [{ ...first, targetId: 'tampered-subject' }, second],
      };
      const racingStore: OperationalStore = {
        execute: async statement => {
          const result = await store.execute(statement);
          if (statement.sql.includes('incident.status AS incident_status')) {
            terminalReadbackSeen = true;
          }
          return result;
        },
        transaction: async operation => {
          if (terminalReadbackSeen && !raceInjected) {
            raceInjected = true;
            await store.execute({
              sql: `UPDATE containment_plans SET plan_json = ?
                WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
                  AND id = ?`,
              args: [JSON.stringify(tamperedPlan), plan.planId],
            });
          }
          return store.transaction(operation);
        },
        close: () => undefined,
      };

      await expect(
        retryPartialContainment(
          racingStore,
          {
            tenantId: 'tenant-1',
            incidentId: 'incident-1',
            workflowRunId: 'run-1',
            approvalId: 'approval-1',
            correlationId: 'retry-correlation-1',
            state: prepared.state,
            mode: 'local',
            timeoutMs: 1_000,
            rateLimit: 8,
          },
          { clock: fixedClock('2026-08-27T12:04:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });

      expect(raceInjected).toBe(true);
      const interrupted = await store.execute({
        sql: `SELECT status, closed_at FROM incidents
          WHERE tenant_id = 'tenant-1' AND id = 'incident-1'`,
      });
      expect(interrupted.rows[0]).toEqual({
        status: 'contained',
        closed_at: null,
      });
      const terminalEvents = await store.execute({
        sql: `SELECT count(*) AS count FROM timeline_events
          WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
            AND type = 'incident.status_changed'
            AND json_extract(payload_json, '$.to') = 'closed'`,
      });
      expect(Number(terminalEvents.rows[0]?.count)).toBe(0);
      expect(prepared.state.calls.get(first.actionId)).toBe(1);
      expect(prepared.state.calls.get(second.actionId)).toBe(2);

      await store.execute({
        sql: `UPDATE containment_plans SET plan_json = ?
          WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
            AND id = ?`,
        args: [JSON.stringify(plan), plan.planId],
      });
      const retryContained = (correlationId = 'retry-correlation-1') =>
        retryPartialContainment(
          store,
          {
            tenantId: 'tenant-1',
            incidentId: 'incident-1',
            workflowRunId: 'run-1',
            approvalId: 'approval-1',
            correlationId,
            state: prepared.state,
            mode: 'local',
            timeoutMs: 1_000,
            rateLimit: 8,
          },
          { clock: fixedClock('2026-08-27T12:04:01.000Z') },
        );
      await store.execute({
        sql: `UPDATE approvals SET decided_by = 'tampered-manager'
          WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
            AND id = 'approval-1'`,
      });
      await expect(retryContained()).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      await store.execute({
        sql: `UPDATE approvals SET decided_by = 'studio-soc-manager'
          WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
            AND id = 'approval-1'`,
      });
      await store.execute({
        sql: `UPDATE containment_actions SET ordinal = 1 - ordinal
          WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
            AND plan_id = ?`,
        args: [plan.planId],
      });
      await expect(retryContained()).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      await store.execute({
        sql: `UPDATE containment_actions
          SET ordinal = CASE action_id WHEN ? THEN 0 ELSE 1 END
          WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
            AND plan_id = ?`,
        args: [first.actionId, plan.planId],
      });
      await expect(retryContained('different-correlation')).rejects.toMatchObject({ code: 'CONFLICT' });
      const stillInterrupted = await store.execute({
        sql: `SELECT status, closed_at FROM incidents
          WHERE tenant_id = 'tenant-1' AND id = 'incident-1'`,
      });
      expect(stillInterrupted.rows[0]).toEqual({
        status: 'contained',
        closed_at: null,
      });
      const dispatcher = new ApprovalRecoveryWorker({
        store,
        provider: new LocalIncidentProvider(),
        reconcileApprovalRun: async () => 'completed',
        containmentState: prepared.state,
        mode: 'local',
        actionTimeoutMs: 1_000,
        rateLimit: 8,
        clock: fixedClock('2026-08-27T12:04:01.000Z'),
      });
      await expect(dispatcher.runOnce()).resolves.toMatchObject({
        containmentRetried: 1,
      });
      const recovered = await store.execute({
        sql: `SELECT status, closed_at FROM incidents
          WHERE tenant_id = 'tenant-1' AND id = 'incident-1'`,
      });
      expect(recovered.rows[0]).toEqual({
        status: 'closed',
        closed_at: '2026-08-27T12:04:01.000Z',
      });
      const recoveredRun = await store.execute({
        sql: "SELECT status, finished_at FROM workflow_runs WHERE run_id = 'run-1'",
      });
      expect(recoveredRun.rows[0]).toEqual({
        status: 'completed',
        finished_at: '2026-08-27T12:04:01.000Z',
      });
      expect(prepared.state.calls.get(first.actionId)).toBe(1);
      expect(prepared.state.calls.get(second.actionId)).toBe(2);
    } finally {
      store.close();
    }
  });

  it('audits a transient external failure and converges by the same delivery key', async () => {
    const { store, plan } = await setup();
    try {
      const provider = new LocalIncidentProvider({ failAttempts: 1 });
      let now = '2026-08-27T12:02:00.000Z';
      const clock: Clock = { now: () => now };
      const projection = ExternalIncidentProjectionSchema.parse({
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        kind: 'unauthorized_privilege_change',
        severity: 'high',
        status: 'awaiting_approval',
        occurredAt: '2026-08-27T12:00:00.000Z',
        summaryCode: 'PRIVILEGE_CHANGE_REQUIRES_REVIEW',
        planHashVersion: 1,
        planHash: plan.planHash,
        actionTypes: plan.actions.map(action => action.type),
      });
      await expect(
        deliverExternalIncident(
          store,
          provider,
          {
            operation: 'open-awaiting-approval',
            projection,
            workflowRunId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock, ids: sequenceIdGenerator(['provider-timeline-1']) },
        ),
      ).resolves.toMatchObject({ status: 'retry_scheduled' });
      now = '2026-08-27T12:02:01.000Z';
      const dispatcher = new ApprovalRecoveryWorker({
        store,
        provider,
        reconcileApprovalRun: async () => 'completed',
        clock,
        ids: sequenceIdGenerator(['provider-timeline-2']),
      });
      await expect(dispatcher.runOnce()).resolves.toMatchObject({
        delivered: 1,
      });
      const delivery = await store.execute({
        sql: 'SELECT status, attempt_count, external_ref FROM provider_deliveries',
      });
      expect(delivery.rows[0]).toMatchObject({
        status: 'succeeded',
        attempt_count: 2,
      });
      expect(provider.calls).toHaveLength(2);
    } finally {
      store.close();
    }
  });

  it('records the selected Linear provider in the delivery audit', async () => {
    const { store, plan } = await setup();
    try {
      const provider: IncidentProvider = {
        providerId: 'linear',
        create: async () => ({ externalRef: 'linear:issue_1' }),
        update: async () => ({ externalRef: 'linear:issue_1' }),
      };
      await expect(
        deliverExternalIncident(
          store,
          provider,
          {
            operation: 'open-awaiting-approval',
            projection: ExternalIncidentProjectionSchema.parse({
              incidentId: 'incident-1',
              tenantId: 'tenant-1',
              kind: 'unauthorized_privilege_change',
              severity: 'high',
              status: 'awaiting_approval',
              occurredAt: '2026-08-27T12:00:00.000Z',
              summaryCode: 'PRIVILEGE_CHANGE_REQUIRES_REVIEW',
              planHashVersion: 1,
              planHash: plan.planHash,
              actionTypes: plan.actions.map(action => action.type),
            }),
            workflowRunId: 'run-1',
            correlationId: 'correlation-1',
          },
          { ids: sequenceIdGenerator(['linear-audit']) },
        ),
      ).resolves.toMatchObject({ status: 'succeeded' });
      const audit = await store.execute({
        sql: `SELECT payload_json FROM timeline_events
          WHERE type = 'provider.incident_delivery' ORDER BY sequence DESC LIMIT 1`,
      });
      expect(JSON.parse(String(audit.rows[0]?.payload_json))).toMatchObject({
        provider: 'linear',
      });
    } finally {
      store.close();
    }
  });

  it('terminates a final delivery when its external create dependency is exhausted', async () => {
    const { store, plan } = await setup();
    try {
      const provider = new LocalIncidentProvider({ failAttempts: 1 });
      const clock = fixedClock('2026-08-27T12:02:00.000Z');
      const base = {
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        kind: 'unauthorized_privilege_change' as const,
        severity: 'high' as const,
        occurredAt: '2026-08-27T12:00:00.000Z',
        planHashVersion: 1 as const,
        planHash: plan.planHash,
        actionTypes: plan.actions.map(action => action.type),
      };
      const finalProjection = ExternalIncidentProjectionSchema.parse({
        ...base,
        status: 'failed',
        summaryCode: 'CONTAINMENT_FAILED',
      });
      await expect(
        deliverExternalIncident(
          store,
          provider,
          {
            operation: 'final-failed',
            projection: finalProjection,
            workflowRunId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock },
        ),
      ).resolves.toMatchObject({ status: 'in_progress', attemptCount: 0 });
      const waitingDispatcher = new ApprovalRecoveryWorker({
        store,
        provider,
        clock,
        reconcileApprovalRun: async () => 'completed',
      });
      await expect(waitingDispatcher.runOnce()).resolves.toMatchObject({
        delivered: 0,
      });
      const openProjection = ExternalIncidentProjectionSchema.parse({
        ...base,
        status: 'awaiting_approval',
        summaryCode: 'PRIVILEGE_CHANGE_REQUIRES_REVIEW',
      });
      await expect(
        deliverExternalIncident(
          store,
          provider,
          {
            operation: 'open-awaiting-approval',
            projection: openProjection,
            workflowRunId: 'run-1',
            correlationId: 'correlation-1',
          },
          {
            clock,
            ids: sequenceIdGenerator(['open-exhausted-audit']),
            maxAttempts: 1,
          },
        ),
      ).resolves.toMatchObject({ status: 'exhausted' });
      const dispatcher = new ApprovalRecoveryWorker({
        store,
        provider,
        clock,
        reconcileApprovalRun: async () => 'completed',
        ids: sequenceIdGenerator(['dependency-exhausted-audit']),
      });
      await expect(dispatcher.runOnce()).resolves.toMatchObject({
        delivered: 1,
      });
      await expect(dispatcher.runOnce()).resolves.toMatchObject({
        delivered: 0,
      });
      const deliveries = await store.execute({
        sql: `SELECT operation, status, attempt_count, error_code
          FROM provider_deliveries ORDER BY operation`,
      });
      expect(deliveries.rows).toEqual([
        {
          operation: 'final-failed',
          status: 'exhausted',
          attempt_count: 0,
          error_code: 'PROVIDER_DEPENDENCY_EXHAUSTED',
        },
        {
          operation: 'open-awaiting-approval',
          status: 'exhausted',
          attempt_count: 1,
          error_code: 'PROVIDER_UNAVAILABLE',
        },
      ]);
    } finally {
      store.close();
    }
  });

  it('supersedes a stale final-failed retry after partial recovery closes the incident', async () => {
    const { store, plan } = await setup();
    try {
      let now = '2026-08-27T12:02:00.000Z';
      const clock: Clock = { now: () => now };
      let externalStatus = 'none';
      let failOldFinal = true;
      const calls: string[] = [];
      const provider: IncidentProvider = {
        create: async ({ projection }) => {
          calls.push('open');
          externalStatus = projection.status;
          return { externalRef: 'local-incident-0000000000000001' };
        },
        update: async ({ projection }) => {
          if (projection.summaryCode === 'CONTAINMENT_FAILED' && failOldFinal) {
            failOldFinal = false;
            calls.push('final-failed-error');
            throw new Error('transient final failure');
          }
          calls.push(projection.summaryCode);
          externalStatus = projection.status;
          return { externalRef: 'local-incident-0000000000000001' };
        },
      };
      const base = {
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        kind: 'unauthorized_privilege_change' as const,
        severity: 'high' as const,
        occurredAt: '2026-08-27T12:00:00.000Z',
        planHashVersion: 1 as const,
        planHash: plan.planHash,
        actionTypes: plan.actions.map(action => action.type),
      };
      await deliverExternalIncident(
        store,
        provider,
        {
          operation: 'open-awaiting-approval',
          projection: ExternalIncidentProjectionSchema.parse({
            ...base,
            status: 'awaiting_approval',
            summaryCode: 'PRIVILEGE_CHANGE_REQUIRES_REVIEW',
          }),
          workflowRunId: 'run-1',
          correlationId: 'correlation-1',
        },
        { clock, ids: sequenceIdGenerator(['open-audit']) },
      );
      await expect(
        deliverExternalIncident(
          store,
          provider,
          {
            operation: 'final-failed',
            projection: ExternalIncidentProjectionSchema.parse({
              ...base,
              status: 'failed',
              summaryCode: 'CONTAINMENT_FAILED',
            }),
            workflowRunId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock, ids: sequenceIdGenerator(['failed-retry-audit']) },
        ),
      ).resolves.toMatchObject({ status: 'retry_scheduled' });
      await store.execute({
        sql: `UPDATE incidents SET status = 'closed', updated_at = ?
          WHERE tenant_id = 'tenant-1' AND id = 'incident-1'`,
        args: [now],
      });
      await expect(
        deliverExternalIncident(
          store,
          provider,
          {
            operation: 'final-contained',
            projection: ExternalIncidentProjectionSchema.parse({
              ...base,
              status: 'closed',
              summaryCode: 'CONTAINMENT_SUCCEEDED',
            }),
            workflowRunId: 'run-1',
            correlationId: 'partial-retry-1',
          },
          { clock, ids: sequenceIdGenerator(['contained-audit']) },
        ),
      ).resolves.toMatchObject({ status: 'succeeded' });
      expect(externalStatus).toBe('closed');
      now = '2026-08-27T12:02:01.000Z';
      const dispatcher = new ApprovalRecoveryWorker({
        store,
        provider,
        clock,
        reconcileApprovalRun: async () => 'completed',
        ids: sequenceIdGenerator(['superseded-audit']),
      });
      await expect(dispatcher.runOnce()).resolves.toMatchObject({
        delivered: 1,
      });
      expect(externalStatus).toBe('closed');
      expect(calls).toEqual(['open', 'final-failed-error', 'CONTAINMENT_SUCCEEDED']);
      const stale = await store.execute({
        sql: `SELECT status, error_code FROM provider_deliveries
          WHERE operation = 'final-failed'`,
      });
      expect(stale.rows[0]).toEqual({
        status: 'exhausted',
        error_code: 'PROVIDER_DELIVERY_SUPERSEDED',
      });
      const incident = await store.execute({
        sql: "SELECT status FROM incidents WHERE id = 'incident-1'",
      });
      expect(incident.rows[0]?.status).toBe('closed');
    } finally {
      store.close();
    }
  });

  it('rechecks final-failed supersession after claim and before the provider update', async () => {
    const { store, plan } = await setup();
    try {
      let now = '2026-08-27T12:02:00.000Z';
      const clock: Clock = { now: () => now };
      let externalStatus = 'none';
      let finalFailedCalls = 0;
      const provider: IncidentProvider = {
        create: async ({ projection }) => {
          externalStatus = projection.status;
          return { externalRef: 'local-incident-0000000000000001' };
        },
        update: async ({ projection }) => {
          if (projection.summaryCode === 'CONTAINMENT_FAILED') {
            finalFailedCalls += 1;
            if (finalFailedCalls === 1) throw new Error('transient failure');
          }
          externalStatus = projection.status;
          return { externalRef: 'local-incident-0000000000000001' };
        },
      };
      const base = {
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        kind: 'unauthorized_privilege_change' as const,
        severity: 'high' as const,
        occurredAt: '2026-08-27T12:00:00.000Z',
        planHashVersion: 1 as const,
        planHash: plan.planHash,
        actionTypes: plan.actions.map(action => action.type),
      };
      await deliverExternalIncident(
        store,
        provider,
        {
          operation: 'open-awaiting-approval',
          projection: ExternalIncidentProjectionSchema.parse({
            ...base,
            status: 'awaiting_approval',
            summaryCode: 'PRIVILEGE_CHANGE_REQUIRES_REVIEW',
          }),
          workflowRunId: 'run-1',
          correlationId: 'correlation-1',
        },
        { clock, ids: sequenceIdGenerator(['open-audit']) },
      );
      const failedProjection = ExternalIncidentProjectionSchema.parse({
        ...base,
        status: 'failed',
        summaryCode: 'CONTAINMENT_FAILED',
      });
      await expect(
        deliverExternalIncident(
          store,
          provider,
          {
            operation: 'final-failed',
            projection: failedProjection,
            workflowRunId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock, ids: sequenceIdGenerator(['failed-retry-audit']) },
        ),
      ).resolves.toMatchObject({ status: 'retry_scheduled' });
      now = '2026-08-27T12:02:01.000Z';
      let recoveryInterleaved = false;
      const interleavingStore: OperationalStore = {
        transaction: operation => store.transaction(operation),
        execute: async statement => {
          if (!recoveryInterleaved && statement.sql.includes('SELECT status FROM incidents')) {
            recoveryInterleaved = true;
            await store.execute({
              sql: `UPDATE incidents SET status = 'closed', updated_at = ?
                WHERE tenant_id = 'tenant-1' AND id = 'incident-1'`,
              args: [now],
            });
            externalStatus = 'closed';
          }
          return store.execute(statement);
        },
        close: () => undefined,
      };
      await expect(
        deliverExternalIncident(
          interleavingStore,
          provider,
          {
            operation: 'final-failed',
            projection: failedProjection,
            workflowRunId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock, ids: sequenceIdGenerator(['superseded-after-claim-audit']) },
        ),
      ).resolves.toMatchObject({ status: 'exhausted', attemptCount: 2 });
      expect(recoveryInterleaved).toBe(true);
      expect(finalFailedCalls).toBe(1);
      expect(externalStatus).toBe('closed');
      const delivery = await store.execute({
        sql: `SELECT status, error_code FROM provider_deliveries
          WHERE operation = 'final-failed'`,
      });
      expect(delivery.rows[0]).toEqual({
        status: 'exhausted',
        error_code: 'PROVIDER_DELIVERY_SUPERSEDED',
      });
    } finally {
      store.close();
    }
  });

  it('rejects a stale final-failed generation inside the provider after a concurrent recovery', async () => {
    const { store, plan } = await setup();
    try {
      let now = '2026-08-27T12:02:00.000Z';
      const clock: Clock = { now: () => now };
      let finalFailedAttempt = 0;
      let enterStaleUpdate!: () => void;
      let releaseStaleUpdate!: () => void;
      const staleUpdateEntered = new Promise<void>(resolve => {
        enterStaleUpdate = resolve;
      });
      const staleUpdateRelease = new Promise<void>(resolve => {
        releaseStaleUpdate = resolve;
      });
      const provider = new LocalIncidentProvider({
        store,
        beforePersist: async ({ projection }) => {
          if (projection.summaryCode !== 'CONTAINMENT_FAILED') return;
          finalFailedAttempt += 1;
          if (finalFailedAttempt === 1) throw new Error('transient failure');
          enterStaleUpdate();
          await staleUpdateRelease;
        },
      });
      const base = {
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        kind: 'unauthorized_privilege_change' as const,
        severity: 'high' as const,
        occurredAt: '2026-08-27T12:00:00.000Z',
        planHashVersion: 1 as const,
        planHash: plan.planHash,
        actionTypes: plan.actions.map(action => action.type),
      };
      await deliverExternalIncident(
        store,
        provider,
        {
          operation: 'open-awaiting-approval',
          projection: ExternalIncidentProjectionSchema.parse({
            ...base,
            status: 'awaiting_approval',
            summaryCode: 'PRIVILEGE_CHANGE_REQUIRES_REVIEW',
          }),
          workflowRunId: 'run-1',
          correlationId: 'correlation-1',
        },
        { clock, ids: sequenceIdGenerator(['open-audit']) },
      );
      await store.execute({
        sql: `UPDATE incidents SET status = 'failed', version = version + 1,
          updated_at = ? WHERE tenant_id = 'tenant-1' AND id = 'incident-1'`,
        args: [now],
      });
      const failedProjection = ExternalIncidentProjectionSchema.parse({
        ...base,
        status: 'failed',
        summaryCode: 'CONTAINMENT_FAILED',
      });
      await expect(
        deliverExternalIncident(
          store,
          provider,
          {
            operation: 'final-failed',
            projection: failedProjection,
            workflowRunId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock, ids: sequenceIdGenerator(['failed-retry-audit']) },
        ),
      ).resolves.toMatchObject({ status: 'retry_scheduled' });
      now = '2026-08-27T12:02:01.000Z';
      const stale = deliverExternalIncident(
        store,
        provider,
        {
          operation: 'final-failed',
          projection: failedProjection,
          workflowRunId: 'run-1',
          correlationId: 'correlation-1',
        },
        { clock, ids: sequenceIdGenerator(['superseded-audit']) },
      );
      await staleUpdateEntered;
      await store.execute({
        sql: `UPDATE incidents SET status = 'closed', version = version + 1,
          updated_at = ? WHERE tenant_id = 'tenant-1' AND id = 'incident-1'`,
        args: [now],
      });
      await expect(
        deliverExternalIncident(
          store,
          provider,
          {
            operation: 'final-contained',
            projection: ExternalIncidentProjectionSchema.parse({
              ...base,
              status: 'closed',
              summaryCode: 'CONTAINMENT_SUCCEEDED',
            }),
            workflowRunId: 'run-1',
            correlationId: 'partial-retry-1',
          },
          { clock, ids: sequenceIdGenerator(['contained-audit']) },
        ),
      ).resolves.toMatchObject({ status: 'succeeded' });
      releaseStaleUpdate();
      await expect(stale).resolves.toMatchObject({
        status: 'exhausted',
        attemptCount: 2,
      });
      const external = await store.execute({
        sql: `SELECT generation, projection_json
          FROM local_incident_provider_effects
          WHERE tenant_id = 'tenant-1' AND incident_id = 'incident-1'
          ORDER BY generation DESC LIMIT 1`,
      });
      expect(external.rows[0]?.generation).toBe(4);
      expect(JSON.parse(String(external.rows[0]?.projection_json))).toMatchObject({
        status: 'closed',
        summaryCode: 'CONTAINMENT_SUCCEEDED',
      });
      const staleDelivery = await store.execute({
        sql: `SELECT status, error_code FROM provider_deliveries
          WHERE operation = 'final-failed'`,
      });
      expect(staleDelivery.rows[0]).toEqual({
        status: 'exhausted',
        error_code: 'PROVIDER_DELIVERY_SUPERSEDED',
      });
    } finally {
      store.close();
    }
  });

  it.each([
    ['empty', { externalRef: '' }],
    ['invalid-format', { externalRef: 'external-ticket-1' }],
    ['extra-field', { externalRef: 'local-incident-0000000000000001', secret: 'must-drop' }],
  ])('fails closed for a %s provider result and terminalizes its dependent update', async (_case, malformed) => {
    const { store, plan } = await setup();
    try {
      let providerCalls = 0;
      const provider: IncidentProvider = {
        create: async () => {
          providerCalls += 1;
          return malformed as never;
        },
        update: async () => {
          providerCalls += 1;
          return malformed as never;
        },
      };
      const base = {
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        kind: 'unauthorized_privilege_change' as const,
        severity: 'high' as const,
        occurredAt: '2026-08-27T12:00:00.000Z',
        planHashVersion: 1 as const,
        planHash: plan.planHash,
        actionTypes: plan.actions.map(action => action.type),
      };
      await expect(
        deliverExternalIncident(
          store,
          provider,
          {
            operation: 'open-awaiting-approval',
            projection: ExternalIncidentProjectionSchema.parse({
              ...base,
              status: 'awaiting_approval',
              summaryCode: 'PRIVILEGE_CHANGE_REQUIRES_REVIEW',
            }),
            workflowRunId: 'run-1',
            correlationId: 'correlation-1',
          },
          {
            clock: fixedClock('2026-08-27T12:02:00.000Z'),
            ids: sequenceIdGenerator(['malformed-open-audit']),
            maxAttempts: 1,
          },
        ),
      ).resolves.toMatchObject({ status: 'exhausted' });
      await expect(
        deliverExternalIncident(
          store,
          provider,
          {
            operation: 'final-failed',
            projection: ExternalIncidentProjectionSchema.parse({
              ...base,
              status: 'failed',
              summaryCode: 'CONTAINMENT_FAILED',
            }),
            workflowRunId: 'run-1',
            correlationId: 'correlation-1',
          },
          {
            clock: fixedClock('2026-08-27T12:02:01.000Z'),
            ids: sequenceIdGenerator(['malformed-dependent-audit']),
            maxAttempts: 1,
          },
        ),
      ).resolves.toMatchObject({ status: 'exhausted' });
      const deliveries = await store.execute({
        sql: `SELECT operation, status, external_ref, error_code
            FROM provider_deliveries ORDER BY operation`,
      });
      expect(deliveries.rows).toEqual([
        {
          operation: 'final-failed',
          status: 'exhausted',
          external_ref: null,
          error_code: 'PROVIDER_DEPENDENCY_EXHAUSTED',
        },
        {
          operation: 'open-awaiting-approval',
          status: 'exhausted',
          external_ref: null,
          error_code: 'PROVIDER_UNAVAILABLE',
        },
      ]);
      expect(JSON.stringify(deliveries.rows)).not.toContain('must-drop');
      expect(providerCalls).toBe(1);
    } finally {
      store.close();
    }
  });

  it('atomically reconciles provider success with its delivery audit', async () => {
    const { store, plan } = await setup();
    try {
      let now = '2026-08-27T12:02:00.000Z';
      const clock: Clock = { now: () => now };
      const providerBeforeRestart = new LocalIncidentProvider({ store });
      const projection = ExternalIncidentProjectionSchema.parse({
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        kind: 'unauthorized_privilege_change',
        severity: 'high',
        status: 'awaiting_approval',
        occurredAt: '2026-08-27T12:00:00.000Z',
        summaryCode: 'PRIVILEGE_CHANGE_REQUIRES_REVIEW',
        planHashVersion: 1,
        planHash: plan.planHash,
        actionTypes: plan.actions.map(action => action.type),
      });
      let failAuditInsert = true;
      const faultStore: OperationalStore = {
        execute: statement => store.execute(statement),
        transaction: operation =>
          store.transaction(tx =>
            operation({
              execute: async statement => {
                if (failAuditInsert && statement.sql.includes('INSERT INTO timeline_events')) {
                  failAuditInsert = false;
                  throw new Error('audit insert unavailable');
                }
                return tx.execute(statement);
              },
              batch: statements => tx.batch(statements),
            }),
          ),
        close: () => {},
      };
      await expect(
        deliverExternalIncident(
          faultStore,
          providerBeforeRestart,
          {
            operation: 'open-awaiting-approval',
            projection,
            workflowRunId: 'run-1',
            correlationId: 'correlation-1',
          },
          {
            clock,
            timeoutMs: 1_000,
            ids: sequenceIdGenerator(['rolled-back-provider-audit']),
          },
        ),
      ).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
      const rolledBack = await store.execute({
        sql: `SELECT status, attempt_count, external_ref,
          (SELECT count(*) FROM timeline_events
            WHERE type = 'provider.incident_delivery') AS audit_count
          FROM provider_deliveries`,
      });
      expect(rolledBack.rows[0]).toEqual({
        status: 'delivering',
        attempt_count: 1,
        external_ref: null,
        audit_count: 0,
      });
      now = '2026-08-27T12:02:03.000Z';
      const providerAfterRestart = new LocalIncidentProvider({ store });
      await expect(
        deliverExternalIncident(
          store,
          providerAfterRestart,
          {
            operation: 'open-awaiting-approval',
            projection,
            workflowRunId: 'run-1',
            correlationId: 'correlation-1',
          },
          {
            clock,
            timeoutMs: 1_000,
            ids: sequenceIdGenerator(['reconciled-provider-audit']),
          },
        ),
      ).resolves.toMatchObject({ status: 'succeeded', attemptCount: 2 });
      const reconciled = await store.execute({
        sql: `SELECT status, attempt_count, external_ref,
          (SELECT count(*) FROM timeline_events
            WHERE type = 'provider.incident_delivery') AS audit_count
          FROM provider_deliveries`,
      });
      expect(reconciled.rows[0]).toMatchObject({
        status: 'succeeded',
        attempt_count: 2,
        audit_count: 1,
      });
      expect(providerBeforeRestart.calls).toHaveLength(1);
      expect(providerAfterRestart.calls).toHaveLength(0);
    } finally {
      store.close();
    }
  });
});

function mockState(): LocalContainmentState {
  return {
    sessions: new Map(),
    roles: new Map(),
    devices: new Map(),
    reauthentication: new Map(),
    calls: new Map(),
  };
}

function gatewayFor(
  store: Awaited<ReturnType<typeof setup>>['store'],
  state: LocalContainmentState,
  mode: 'local' | 'staging' | 'production' = 'local',
) {
  return new ContainmentGateway({
    store,
    state,
    mode,
    timeoutMs: 1_000,
    rateLimit: 8,
    clock: fixedClock('2026-08-27T12:03:00.000Z'),
  });
}
