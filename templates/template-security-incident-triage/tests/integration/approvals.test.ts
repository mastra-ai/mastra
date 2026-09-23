import { afterEach, describe, expect, it } from 'vitest';

import { decideApproval, requestApproval } from '../../src/db/approval-operations.js';
import { createIncidentFromAlert, getIncident, transitionIncident } from '../../src/db/incident-operations.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { fixedClock } from '../../src/domain/clock.js';
import { DomainError } from '../../src/domain/errors.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { appendTimelineEvent } from '../../src/db/timeline-operations.js';
import type { ApprovalDecision } from '../../src/schemas/approval.js';
import {
  makeAlert,
  makeApprovalRequest,
  makePlan,
  planHash,
  seedAuthoritativeTriageResult,
} from '../fixtures/domain.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

async function setupApproval() {
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
  await seedAuthoritativeTriageResult(store);
  await requestApproval(
    store,
    {
      plan: makePlan(),
      approval: makeApprovalRequest(),
      expectedIncidentVersion: 1,
      runId: 'run-1',
      correlationId: 'correlation-1',
    },
    {
      clock: fixedClock('2026-08-27T12:01:00.000Z'),
      ids: sequenceIdGenerator(['action-row-1', 'timeline-3', 'outbox-3']),
    },
  );
  return { database, store };
}

function decision(value: 'approved' | 'rejected'): ApprovalDecision {
  const base = {
    schemaVersion: 1 as const,
    approvalId: 'approval-1',
    planId: 'plan-1',
    incidentId: 'incident-1',
    tenantId: 'tenant-1',
    planHashVersion: 1,
    planHash,
    decidedBy: 'manager-1',
    decidedByRole: 'soc_manager' as const,
    decidedAt: '2026-08-27T12:02:00.000Z',
  };
  return value === 'approved'
    ? { ...base, decision: 'approved' }
    : { ...base, decision: 'rejected', reason: 'Needs more evidence.' };
}

async function expectValidationFailure(operation: Promise<unknown>) {
  try {
    await operation;
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    if (!(error instanceof DomainError)) throw error;
    expect(error).toMatchObject({
      name: 'DomainError',
      code: 'VALIDATION_FAILED',
      message: 'The request is invalid.',
      retryable: false,
    });
    expect(error.toPublic()).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'The request is invalid.',
      retryable: false,
    });
    expect(error).not.toHaveProperty('issues');
    return;
  }
  throw new Error('expected validation failure');
}

describe('approval decisions', () => {
  it('maps invalid plan, request and decision inputs without partial effects', async () => {
    const { store } = await setupApproval();
    try {
      const before = await store.execute({
        sql: `SELECT
          (SELECT status FROM incidents WHERE id = 'incident-1') AS status,
          (SELECT version FROM incidents WHERE id = 'incident-1') AS version,
          (SELECT current_plan_id FROM incidents WHERE id = 'incident-1') AS current_plan_id,
          (SELECT decision FROM approvals WHERE id = 'approval-1') AS decision,
          (SELECT count(*) FROM containment_plans) AS plan_count,
          (SELECT count(*) FROM containment_actions) AS action_count,
          (SELECT count(*) FROM approvals) AS approval_count,
          (SELECT count(*) FROM timeline_events) AS timeline_count,
          (SELECT count(*) FROM outbox_events) AS outbox_count`,
      });

      await expectValidationFailure(
        requestApproval(
          store,
          {
            plan: makePlan({ planId: '' }),
            approval: makeApprovalRequest(),
            expectedIncidentVersion: 2,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock: fixedClock('2026-08-27T12:02:00.000Z') },
        ),
      );
      await expectValidationFailure(
        requestApproval(
          store,
          {
            plan: makePlan(),
            approval: makeApprovalRequest({ approvalId: '' }),
            expectedIncidentVersion: 2,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock: fixedClock('2026-08-27T12:02:00.000Z') },
        ),
      );
      await expectValidationFailure(
        decideApproval(store, {
          decision: {
            ...decision('approved'),
            decidedByRole: 'soc_analyst',
          } as never,
          expectedIncidentVersion: 2,
          runId: 'run-1',
          correlationId: 'correlation-1',
        }),
      );

      const after = await store.execute({
        sql: `SELECT
          (SELECT status FROM incidents WHERE id = 'incident-1') AS status,
          (SELECT version FROM incidents WHERE id = 'incident-1') AS version,
          (SELECT current_plan_id FROM incidents WHERE id = 'incident-1') AS current_plan_id,
          (SELECT decision FROM approvals WHERE id = 'approval-1') AS decision,
          (SELECT count(*) FROM containment_plans) AS plan_count,
          (SELECT count(*) FROM containment_actions) AS action_count,
          (SELECT count(*) FROM approvals) AS approval_count,
          (SELECT count(*) FROM timeline_events) AS timeline_count,
          (SELECT count(*) FROM outbox_events) AS outbox_count`,
      });
      expect(after.rows[0]).toEqual(before.rows[0]);
    } finally {
      store.close();
    }
  });

  it('reserves approval state transitions for the atomic decision operation', async () => {
    const { store } = await setupApproval();
    try {
      for (const to of ['approved', 'rejected'] as const) {
        await expect(
          transitionIncident(store, {
            tenantId: 'tenant-1',
            incidentId: 'incident-1',
            expectedVersion: 2,
            to,
            runId: 'run-1',
            correlationId: 'correlation-1',
          }),
        ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      }

      expect(await getIncident(store, 'tenant-1', 'incident-1')).toMatchObject({
        status: 'awaiting_approval',
        version: 2,
        timelineSequence: 3,
      });
      const unchanged = await store.execute({
        sql: `SELECT
          (SELECT decision FROM approvals WHERE id = 'approval-1') AS decision,
          (SELECT count(*) FROM timeline_events) AS timeline_count,
          (SELECT count(*) FROM outbox_events) AS outbox_count`,
      });
      expect(unchanged.rows[0]).toEqual({
        decision: null,
        timeline_count: 3,
        outbox_count: 3,
      });

      await decideApproval(
        store,
        {
          decision: decision('approved'),
          expectedIncidentVersion: 2,
          runId: 'run-1',
          correlationId: 'correlation-1',
        },
        {
          clock: fixedClock('2026-08-27T12:02:00.000Z'),
          ids: sequenceIdGenerator(['timeline-4', 'outbox-4']),
        },
      );
      expect(await getIncident(store, 'tenant-1', 'incident-1')).toMatchObject({
        status: 'approved',
        version: 3,
        timelineSequence: 4,
      });
      const authorized = await store.execute({
        sql: `SELECT
          (SELECT decision FROM approvals WHERE id = 'approval-1') AS decision,
          (SELECT count(*) FROM timeline_events) AS timeline_count,
          (SELECT count(*) FROM outbox_events) AS outbox_count`,
      });
      expect(authorized.rows[0]).toEqual({
        decision: 'approved',
        timeline_count: 4,
        outbox_count: 4,
      });
    } finally {
      store.close();
    }
  });

  it('allows exactly one winner under concurrent approve/reject', async () => {
    const { database, store: first } = await setupApproval();
    const second = database.createStore();
    try {
      const results = await Promise.allSettled([
        decideApproval(
          first,
          {
            decision: decision('approved'),
            expectedIncidentVersion: 2,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          {
            clock: fixedClock('2026-08-27T12:02:00.000Z'),
            ids: sequenceIdGenerator(['timeline-approved', 'outbox-approved']),
          },
        ),
        decideApproval(
          second,
          {
            decision: decision('rejected'),
            expectedIncidentVersion: 2,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          {
            clock: fixedClock('2026-08-27T12:02:00.000Z'),
            ids: sequenceIdGenerator(['timeline-rejected', 'outbox-rejected']),
          },
        ),
      ]);
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
      const winner = results.find(result => result.status === 'fulfilled');
      if (!winner || winner.status !== 'fulfilled') throw new Error('missing winner');
      expect(await getIncident(first, 'tenant-1', 'incident-1')).toMatchObject({
        status: winner.value.decision,
        version: 3,
        timelineSequence: 4,
      });
      const counts = await first.execute({
        sql: `SELECT
          (SELECT count(*) FROM approvals WHERE decision IS NOT NULL) AS decisions,
          (SELECT count(*) FROM timeline_events) AS timeline_count,
          (SELECT count(*) FROM outbox_events) AS outbox_count`,
      });
      expect(counts.rows[0]).toEqual({
        decisions: 1,
        timeline_count: 4,
        outbox_count: 4,
      });
    } finally {
      first.close();
      second.close();
    }
  });

  it('makes an identical replay idempotent and rejects a divergent replay', async () => {
    const { store } = await setupApproval();
    try {
      const approved = decision('approved');
      const input = {
        decision: approved,
        expectedIncidentVersion: 2,
        runId: 'run-1',
        correlationId: 'correlation-1',
      };
      await decideApproval(store, input, {
        clock: fixedClock(approved.decidedAt),
        ids: sequenceIdGenerator(['timeline-4', 'outbox-4']),
      });
      await expect(decideApproval(store, input, { clock: fixedClock(approved.decidedAt) })).resolves.toEqual(approved);
      await expect(
        decideApproval(store, { ...input, decision: decision('rejected') }, { clock: fixedClock(approved.decidedAt) }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      const count = await store.execute({
        sql: "SELECT count(*) AS count FROM timeline_events WHERE type = 'approval.decided'",
      });
      expect(Number(count.rows[0]?.count)).toBe(1);
    } finally {
      store.close();
    }
  });

  it('rejects expired, stale-hash and cross-tenant decisions', async () => {
    const { store } = await setupApproval();
    try {
      await expect(
        decideApproval(
          store,
          {
            decision: decision('approved'),
            expectedIncidentVersion: 2,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock: fixedClock('2026-08-27T14:00:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      await expect(
        decideApproval(
          store,
          {
            decision: { ...decision('approved'), planHash: 'b'.repeat(64) },
            expectedIncidentVersion: 2,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock: fixedClock('2026-08-27T12:02:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      await expect(
        decideApproval(
          store,
          {
            decision: { ...decision('approved'), tenantId: 'tenant-2' },
            expectedIncidentVersion: 2,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock: fixedClock('2026-08-27T12:02:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    } finally {
      store.close();
    }
  });

  it('rejects out-of-order decision timestamps without partial effects', async () => {
    const { store } = await setupApproval();
    try {
      await expect(
        decideApproval(
          store,
          {
            decision: {
              ...decision('approved'),
              decidedAt: '2026-08-27T11:00:00.000Z',
            },
            expectedIncidentVersion: 2,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock: fixedClock('2026-08-27T12:02:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });

      await appendTimelineEvent(
        store,
        {
          incidentId: 'incident-1',
          tenantId: 'tenant-1',
          type: 'review.started',
          correlationId: 'correlation-1',
          payload: { status: 'reviewing' },
        },
        {
          clock: fixedClock('2026-08-27T12:01:30.000Z'),
          ids: sequenceIdGenerator(['timeline-review']),
        },
      );
      await expect(
        decideApproval(
          store,
          {
            decision: {
              ...decision('approved'),
              decidedAt: '2026-08-27T12:01:15.000Z',
            },
            expectedIncidentVersion: 2,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock: fixedClock('2026-08-27T12:02:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });

      const state = await store.execute({
        sql: `SELECT
          (SELECT status FROM incidents WHERE id = 'incident-1') AS status,
          (SELECT updated_at FROM incidents WHERE id = 'incident-1') AS updated_at,
          (SELECT decision FROM approvals WHERE id = 'approval-1') AS decision,
          (SELECT count(*) FROM timeline_events) AS timeline_count,
          (SELECT count(*) FROM outbox_events) AS outbox_count`,
      });
      expect(state.rows[0]).toEqual({
        status: 'awaiting_approval',
        updated_at: '2026-08-27T12:01:30.000Z',
        decision: null,
        timeline_count: 4,
        outbox_count: 3,
      });
    } finally {
      store.close();
    }
  });

  it('rejects temporally invalid approval requests without partial effects', async () => {
    const database = await createTempDatabase();
    databases.push(database);
    const store = database.createStore();
    try {
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
      await expect(
        requestApproval(
          store,
          {
            plan: makePlan({ createdAt: '2026-08-27T12:02:00.000Z' }),
            approval: makeApprovalRequest(),
            expectedIncidentVersion: 1,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock: fixedClock('2026-08-27T12:01:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      await expect(
        requestApproval(
          store,
          {
            plan: makePlan({
              createdAt: '2025-01-01T12:00:00.000Z',
              expiresAt: '2025-01-01T13:00:00.000Z',
            }),
            approval: makeApprovalRequest({
              requestedAt: '2025-01-01T12:01:00.000Z',
              expiresAt: '2025-01-01T13:00:00.000Z',
            }),
            expectedIncidentVersion: 1,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock: fixedClock('2026-08-27T12:01:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
      await expect(
        requestApproval(
          store,
          {
            plan: makePlan({ createdAt: '2026-08-27T12:01:00.000Z' }),
            approval: makeApprovalRequest({
              requestedAt: '2026-08-27T12:02:00.000Z',
            }),
            expectedIncidentVersion: 1,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock: fixedClock('2026-08-27T12:01:30.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

      const state = await store.execute({
        sql: `SELECT status, version, timeline_sequence, current_plan_id, updated_at,
          (SELECT count(*) FROM containment_plans) AS plan_count,
          (SELECT count(*) FROM containment_actions) AS action_count,
          (SELECT count(*) FROM approvals) AS approval_count,
          (SELECT count(*) FROM timeline_events) AS timeline_count,
          (SELECT count(*) FROM outbox_events) AS outbox_count
          FROM incidents WHERE id = 'incident-1'`,
      });
      expect(state.rows[0]).toEqual({
        status: 'investigating',
        version: 1,
        timeline_sequence: 2,
        current_plan_id: null,
        updated_at: '2026-08-27T12:00:30.000Z',
        plan_count: 0,
        action_count: 0,
        approval_count: 0,
        timeline_count: 2,
        outbox_count: 2,
      });
    } finally {
      store.close();
    }
  });

  it('rejects a pending decision after the incident switches to a new plan', async () => {
    const { store } = await setupApproval();
    try {
      await transitionIncident(
        store,
        {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          expectedVersion: 2,
          to: 'failed',
          runId: 'run-1',
          correlationId: 'correlation-1',
        },
        {
          clock: fixedClock('2026-08-27T12:03:00.000Z'),
          ids: sequenceIdGenerator(['timeline-failed', 'outbox-failed']),
        },
      );
      await transitionIncident(
        store,
        {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          expectedVersion: 3,
          to: 'investigating',
          runId: 'run-1',
          correlationId: 'correlation-1',
        },
        {
          clock: fixedClock('2026-08-27T12:04:00.000Z'),
          ids: sequenceIdGenerator(['timeline-recovery', 'outbox-recovery']),
        },
      );

      const secondPlan = makePlan({
        planId: 'plan-2',
        planVersion: 2,
        createdAt: '2026-08-27T12:05:00.000Z',
        expiresAt: '2026-08-27T12:20:00.000Z',
      });
      const secondHash = secondPlan.planHash;
      await store.execute({
        sql: `INSERT INTO workflow_runs(
          id, incident_id, tenant_id, run_id, workflow_id, status, started_at
        ) VALUES ('workflow-row-2', 'incident-1', 'tenant-1', 'run-2',
          'security-incident-workflow', 'running', '2026-08-27T12:04:30.000Z')`,
      });
      await store.execute({
        sql: `UPDATE incidents SET current_run_id = 'run-2'
          WHERE tenant_id = 'tenant-1' AND id = 'incident-1'`,
      });
      await seedAuthoritativeTriageResult(store, secondPlan, 'run-2');
      await requestApproval(
        store,
        {
          plan: secondPlan,
          approval: makeApprovalRequest({
            approvalId: 'approval-2',
            planId: 'plan-2',
            planHash: secondHash,
            requestedAt: '2026-08-27T12:05:00.000Z',
            expiresAt: '2026-08-27T12:20:00.000Z',
          }),
          expectedIncidentVersion: 4,
          runId: 'run-2',
          correlationId: 'correlation-1',
        },
        {
          clock: fixedClock('2026-08-27T12:05:00.000Z'),
          ids: sequenceIdGenerator(['action-row-2', 'timeline-plan-2', 'outbox-plan-2']),
        },
      );

      await expect(
        decideApproval(
          store,
          {
            decision: decision('approved'),
            expectedIncidentVersion: 5,
            runId: 'run-1',
            correlationId: 'correlation-1',
          },
          { clock: fixedClock('2026-08-27T12:02:00.000Z') },
        ),
      ).rejects.toMatchObject({ code: 'CONFLICT' });

      expect(await getIncident(store, 'tenant-1', 'incident-1')).toMatchObject({
        status: 'awaiting_approval',
        version: 5,
        timelineSequence: 6,
      });
      const persisted = await store.execute({
        sql: `SELECT
          (SELECT current_plan_id FROM incidents WHERE id = 'incident-1') AS current_plan_id,
          (SELECT decision FROM approvals WHERE id = 'approval-1') AS old_decision,
          (SELECT decision FROM approvals WHERE id = 'approval-2') AS current_decision,
          (SELECT count(*) FROM timeline_events) AS timeline_count,
          (SELECT count(*) FROM outbox_events) AS outbox_count`,
      });
      expect(persisted.rows[0]).toEqual({
        current_plan_id: 'plan-2',
        old_decision: null,
        current_decision: null,
        timeline_count: 6,
        outbox_count: 6,
      });
    } finally {
      store.close();
    }
  });
});
