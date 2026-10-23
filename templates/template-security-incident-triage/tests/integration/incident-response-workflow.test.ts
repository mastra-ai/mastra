import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, describe, expect, it } from 'vitest';

import { authorizeResumeToken, decideApprovalAndIssueResumeToken } from '../../src/db/approval-operations.js';
import { createIncidentFromAlert } from '../../src/db/incident-operations.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { fixedClock, systemClock, type Clock } from '../../src/domain/clock.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import {
  createConfiguredSecurityIncidentWorkflow,
  materializeSecurityIncidentInput,
} from '../../src/mastra/workflows/security-incident-workflow.js';
import { LocalCloudEvidenceProvider } from '../../src/providers/cloud-evidence-provider.js';
import { LocalEndpointEvidenceProvider } from '../../src/providers/endpoint-evidence-provider.js';
import { LocalIdentityEvidenceProvider } from '../../src/providers/identity-evidence-provider.js';
import { LocalIncidentProvider } from '../../src/providers/local-incident-provider.js';
import { ApprovalRecoveryWorker } from '../../src/workers/approval-recovery-worker.js';
import {
  createApprovalRunReconciler,
  createWorkflowApprovalRunReconciler,
  type ApprovalWorkflow,
} from '../../src/approval/workflow-resume-reconciler.js';
import { expirePendingApproval } from '../../src/db/approval-operations.js';
import { DeterministicRunbookEmbedder } from '../../src/mastra/knowledge/embeddings.js';
import { indexRunbook } from '../../src/mastra/knowledge/indexer.js';
import { loadRunbooks } from '../../src/mastra/knowledge/loader.js';
import { retrieveRunbook } from '../../src/mastra/knowledge/retrieve.js';
import { LibSqlRunbookVectorStore } from '../../src/mastra/knowledge/vector-store.js';
import { deterministicResponsePlanner } from '../../src/triage/prompt-safe-decision.js';
import type { LocalContainmentState } from '../../src/containment/local-state.js';
import type { IdentityProvider } from '../../src/providers/identity-provider.js';
import { makeAlert } from '../fixtures/domain.js';
import type { IncidentKind } from '../../src/schemas/incident.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];
const runbookRoot = resolve(process.cwd(), 'runbooks');

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

describe('approval and containment workflow suspend and resume', () => {
  it('refreshes pasted fixtures between runs but preserves intake identity on retry', async () => {
    const database = await setupDatabase('unknown_device_login');
    const store = database.createStore();
    try {
      const input = JSON.parse(await readFile('scripts/fixtures/studio/02-country-us.json', 'utf8'));
      const first = await materializeSecurityIncidentInput(store, input, true, 'studio-run-a');
      const retry = await materializeSecurityIncidentInput(store, input, true, 'studio-run-a');
      const second = await materializeSecurityIncidentInput(store, input, true, 'studio-run-b');
      expect(retry).toEqual(first);
      expect(second.incidentId).not.toBe(first.incidentId);
      expect(
        (
          await store.execute({
            sql: "SELECT count(*) AS n FROM alerts WHERE tenant_id='studio-demo-tenant'",
          })
        ).rows[0]?.n,
      ).toBe(2);
      await expect(materializeSecurityIncidentInput(store, input, false, 'studio-run-c')).rejects.toThrow(
        'STUDIO_WEBHOOK_INPUT_DISABLED',
      );
    } finally {
      store.close();
    }
  });
  it.each(['01-new-device', '02-country-us', '03-country-br', '04-privilege-change'])(
    'runs pasted Studio fixture %s through the actual workflow',
    async name => {
      const database = await setupDatabase('unknown_device_login');
      const state: LocalContainmentState = {
        sessions: new Map(),
        roles: new Map(),
        devices: new Map(),
        reauthentication: new Map(),
        calls: new Map(),
      };
      const definition = createResponseWorkflow(database, systemClock, state, new LocalIncidentProvider(), undefined, {
        studioLocalDecisions: true,
        fixtureInputs: true,
      });
      const storage = new LibSQLStore({
        id: `fixture-${name}`,
        url: database.url,
      });
      const store = database.createStore();
      try {
        const runtime = new Mastra({
          storage,
          workflows: { demo: definition },
        });
        const run = await runtime.getWorkflow('demo').createRun();
        const input = JSON.parse(await readFile(`scripts/fixtures/studio/${name}.json`, 'utf8'));
        const first = await run.start({ inputData: input });
        expect(
          (
            await store.execute({
              sql: "SELECT count(*) AS n FROM local_containment_effects WHERE tenant_id='studio-demo-tenant'",
            })
          ).rows[0]?.n,
        ).toBe(0);
        if (name === '02-country-us') {
          expect(first).toMatchObject({
            status: 'success',
            result: { status: 'benign' },
          });
          expect(
            (
              await store.execute({
                sql: "SELECT count(*) AS n FROM approvals WHERE tenant_id='studio-demo-tenant'",
              })
            ).rows[0]?.n,
          ).toBe(0);
        } else {
          expect(first.status).toBe('suspended');
          const result = await run.resume({
            step: 'await-approval',
            resumeData: JSON.parse(await readFile('scripts/fixtures/studio/resolve.json', 'utf8')),
          });
          expect(result).toMatchObject({
            status: 'success',
            result: { status: 'contained' },
          });
          expect(
            Number(
              (
                await store.execute({
                  sql: "SELECT count(*) AS n FROM local_containment_effects WHERE tenant_id='studio-demo-tenant'",
                })
              ).rows[0]?.n,
            ),
          ).toBeGreaterThan(0);
        }
      } finally {
        store.close();
        await storage.close();
      }
    },
  );
  it.each(['approved', 'rejected'] as const)(
    'accepts a local Studio %s JSON, with durable authority and no early effects',
    async decision => {
      const database = await setupDatabase('unknown_device_login');
      const state: LocalContainmentState = {
        sessions: new Map(),
        roles: new Map(),
        devices: new Map(),
        reauthentication: new Map(),
        calls: new Map(),
      };
      const definition = createResponseWorkflow(
        database,
        fixedClock('2026-08-28T10:02:00.000Z'),
        state,
        new LocalIncidentProvider(),
        undefined,
        { studioLocalDecisions: true },
      );
      const storage = new LibSQLStore({
        id: `studio-${decision}`,
        url: database.url,
      });
      const store = database.createStore();
      try {
        const runtime = new Mastra({
          storage,
          workflows: { demo: definition },
        });
        const run = await runtime.getWorkflow('demo').createRun({ runId: 'workflow-run-1' });
        expect((await run.start({ inputData: workflowInput })).status).toBe('suspended');
        expect(
          (
            await store.execute({
              sql: 'SELECT count(*) AS n FROM local_containment_effects',
            })
          ).rows[0]?.n,
        ).toBe(0);
        const resumeData = JSON.parse(
          await readFile(`scripts/fixtures/studio/${decision === 'approved' ? 'resolve' : 'reject'}.json`, 'utf8'),
        );
        const result = await run.resume({ step: 'await-approval', resumeData });
        expect(result).toMatchObject({
          status: 'success',
          result: {
            status: decision === 'approved' ? 'contained' : 'rejected',
          },
        });
        expect(
          (
            await store.execute({
              sql: 'SELECT count(*) AS n FROM local_containment_effects',
            })
          ).rows[0]?.n,
        ).toBe(decision === 'approved' ? 2 : 0);
        expect(
          (
            await store.execute({
              sql: 'SELECT decision,decided_by FROM approvals',
            })
          ).rows[0],
        ).toEqual({ decision, decided_by: 'studio-soc-manager' });
      } finally {
        store.close();
        await storage.close();
      }
    },
  );

  it.each(['disabled', 'staging', 'production'] as const)('rejects plain Studio decisions when %s', async mode => {
    const database = await setupDatabase('unknown_device_login');
    const state: LocalContainmentState = {
      sessions: new Map(),
      roles: new Map(),
      devices: new Map(),
      reauthentication: new Map(),
      calls: new Map(),
    };
    const definition = createResponseWorkflow(
      database,
      fixedClock('2026-08-28T10:02:00.000Z'),
      state,
      new LocalIncidentProvider(),
      undefined,
      {
        studioLocalDecisions: mode !== 'disabled',
        mode: mode === 'disabled' ? 'local' : mode,
        ...(mode !== 'disabled' ? { identityProvider: unusedIdentityProvider } : {}),
      },
    );
    const storage = new LibSQLStore({
      id: `studio-denied-${mode}`,
      url: database.url,
    });
    const store = database.createStore();
    try {
      const runtime = new Mastra({
        storage,
        workflows: { demo: definition },
      });
      const run = await runtime.getWorkflow('demo').createRun({ runId: 'workflow-run-1' });
      expect((await run.start({ inputData: workflowInput })).status).toBe('suspended');
      let rejected = false;
      try {
        const result = await run.resume({
          step: 'await-approval',
          resumeData: {
            localDemoDecision: true,
            decision: 'approved',
            reason: 'test',
          },
        });
        rejected = result.status !== 'success';
      } catch {
        rejected = true;
      }
      expect(rejected).toBe(true);
      expect(
        (
          await store.execute({
            sql: 'SELECT count(*) AS n FROM local_containment_effects',
          })
        ).rows[0]?.n,
      ).toBe(0);
      expect((await store.execute({ sql: 'SELECT decision FROM approvals' })).rows[0]?.decision).toBeNull();
    } finally {
      store.close();
      await storage.close();
    }
  });
  it('approves only provider-supported country actions in staging', async () => {
    const database = await setupDatabase('disallowed_country_login');
    const state: LocalContainmentState = {
      sessions: new Map([['session-1', 'active']]),
      roles: new Map(),
      devices: new Map(),
      reauthentication: new Map(),
      calls: new Map(),
    };
    const definition = createResponseWorkflow(
      database,
      fixedClock('2026-08-28T10:01:00.000Z'),
      state,
      new LocalIncidentProvider(),
      new LocalCloudEvidenceProvider(),
      { mode: 'staging', identityProvider: unusedIdentityProvider },
    );
    const runtimeStorage = new LibSQLStore({
      id: 'response-workflow-staging-country',
      url: database.url,
    });
    const runtime = new Mastra({
      storage: runtimeStorage,
      workflows: { responseWorkflow: definition },
    });
    const run = await runtime.getWorkflow('responseWorkflow').createRun({ runId: 'workflow-run-1' });

    expect((await run.start({ inputData: workflowInput })).status).toBe('suspended');
    const store = database.createStore();
    try {
      const actions = await store.execute({
        sql: `SELECT action_type FROM containment_actions
          WHERE incident_id = 'incident-1' ORDER BY ordinal`,
      });
      expect(actions.rows).toEqual([{ action_type: 'revoke_session' }]);
    } finally {
      store.close();
      await runtimeStorage.close();
    }
  });

  it('closes a benign country login without approval or an external incident', async () => {
    const database = await setupDatabase('disallowed_country_login');
    const state: LocalContainmentState = {
      sessions: new Map(),
      roles: new Map(),
      devices: new Map(),
      reauthentication: new Map(),
      calls: new Map(),
    };
    const external = new LocalIncidentProvider();
    const workflowDefinition = createResponseWorkflow(
      database,
      fixedClock('2026-08-28T10:01:00.000Z'),
      state,
      external,
      new LocalCloudEvidenceProvider({
        countryByIp: { '198.51.100.8': 'US' },
      }),
    );
    const runtimeStorage = new LibSQLStore({
      id: 'response-workflow-benign-country',
      url: database.url,
    });
    const runtime = new Mastra({
      storage: runtimeStorage,
      workflows: { responseWorkflow: workflowDefinition },
    });
    const run = await runtime.getWorkflow('responseWorkflow').createRun({ runId: 'workflow-run-1' });

    const result = await run.start({ inputData: workflowInput });
    expect(result).toMatchObject({
      status: 'success',
      result: {
        status: 'benign',
        incidentId: 'incident-1',
        reasonCodes: ['BENIGN_EXPLANATION'],
      },
    });
    expect(external.calls).toEqual([]);

    const store = database.createStore();
    try {
      const stateRow = await store.execute({
        sql: `SELECT i.status, i.severity, w.status AS workflow_status,
            (SELECT count(*) FROM approvals WHERE incident_id = i.id) AS approvals
          FROM incidents i JOIN workflow_runs w
            ON w.tenant_id = i.tenant_id AND w.incident_id = i.id
          WHERE i.id = 'incident-1'`,
      });
      expect(stateRow.rows[0]).toMatchObject({
        status: 'closed',
        severity: 'low',
        workflow_status: 'completed',
        approvals: 0,
      });
    } finally {
      store.close();
      await runtimeStorage.close();
    }
  });

  it.each([
    ['unauthorized_privilege_change', 'approved'],
    ['unauthorized_privilege_change', 'rejected'],
    ['disallowed_country_login', 'approved'],
    ['disallowed_country_login', 'rejected'],
    ['unknown_device_login', 'approved'],
    ['unknown_device_login', 'rejected'],
  ] as const)('resumes %s after an authenticated %s decision from durable state', async (kind, decision) => {
    const database = await setupDatabase(kind);
    let responseNow = '2026-08-28T10:01:00.000Z';
    const responseClock: Clock = { now: () => responseNow };
    const state: LocalContainmentState = {
      sessions: new Map([['session-1', 'active']]),
      roles: new Map([['subject-1', 'admin']]),
      devices: new Map([['device-new-1', 'clear']]),
      reauthentication: new Map(),
      calls: new Map(),
    };
    const external = new LocalIncidentProvider();
    const workflowDefinition = createResponseWorkflow(database, responseClock, state, external);
    const runtime = new Mastra({
      storage: new LibSQLStore({
        id: `response-workflow-${decision}`,
        url: database.url,
      }),
      workflows: { responseWorkflow: workflowDefinition },
    });
    const workflow = runtime.getWorkflow('responseWorkflow');
    const run = await workflow.createRun({ runId: 'workflow-run-1' });
    const suspended = await run.start({ inputData: workflowInput });
    expect(suspended.status).toBe('suspended');
    if (suspended.status !== 'suspended') return;
    expect(suspended.suspendPayload).toMatchObject({
      'await-approval': {
        incidentId: 'incident-1',
        workflowRunId: 'workflow-run-1',
        planHashVersion: 1,
      },
    });
    expect(JSON.stringify(suspended.suspendPayload)).not.toMatch(/studio-soc-manager|decision|reason|resumeToken/iu);
    const store = database.createStore();
    try {
      const approval = await store.execute({
        sql: `SELECT a.*, i.version FROM approvals a JOIN incidents i
            ON i.tenant_id = a.tenant_id AND i.id = a.incident_id`,
      });
      const row = approval.rows[0]!;
      responseNow = '2026-08-28T10:02:00.000Z';
      const issued = await decideApprovalAndIssueResumeToken(
        store,
        {
          decision:
            decision === 'approved'
              ? {
                  schemaVersion: 1,
                  approvalId: String(row.id),
                  planId: String(row.plan_id),
                  incidentId: 'incident-1',
                  tenantId: 'tenant-1',
                  planHashVersion: 1,
                  planHash: String(row.plan_hash),
                  decision: 'approved',
                  decidedBy: 'studio-soc-manager',
                  decidedByRole: 'soc_manager',
                  decidedAt: responseNow,
                }
              : {
                  schemaVersion: 1,
                  approvalId: String(row.id),
                  planId: String(row.plan_id),
                  incidentId: 'incident-1',
                  tenantId: 'tenant-1',
                  planHashVersion: 1,
                  planHash: String(row.plan_hash),
                  decision: 'rejected',
                  reason: 'More evidence is required.',
                  decidedBy: 'studio-soc-manager',
                  decidedByRole: 'soc_manager',
                  decidedAt: responseNow,
                },
          expectedIncidentVersion: Number(row.version),
          runId: 'workflow-run-1',
          correlationId: 'correlation-1',
          resumeSecret: 'resume-secret-'.padEnd(40, 'x'),
        },
        {
          clock: responseClock,
          ids: sequenceIdGenerator(['decision-timeline', 'decision-outbox']),
        },
      );
      responseNow = '2026-08-28T10:03:00.000Z';
      const authorized = await authorizeResumeToken(
        store,
        {
          token: issued.resumeToken,
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'workflow-run-1',
          approvalId: String(row.id),
        },
        { clock: responseClock },
      );
      const resumed = await run.resume({
        step: 'await-approval',
        resumeData: { resumeReceiptId: authorized.resumeReceiptId },
      });
      expect(resumed.status).toBe('success');
      const tables = await store.execute({
        sql: `SELECT name FROM sqlite_master
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
      });
      for (const table of tables.rows) {
        const tableName = String(table.name).replaceAll('"', '""');
        const contents = await store.execute({
          sql: `SELECT * FROM "${tableName}"`,
        });
        expect(JSON.stringify(contents.rows)).not.toContain(issued.resumeToken);
      }
      if (resumed.status !== 'success') return;
      expect(resumed.result.status).toBe(decision === 'approved' ? 'contained' : 'rejected');
      const final = await store.execute({
        sql: `SELECT i.status,
            (SELECT count(*) FROM containment_action_attempts) AS attempts,
            (SELECT count(*) FROM approval_resume_tokens WHERE consumed_at IS NOT NULL) AS consumed
            FROM incidents i WHERE i.id = 'incident-1'`,
      });
      expect(final.rows[0]).toMatchObject({ status: 'closed', consumed: 1 });
      if (decision === 'approved') {
        expect(Number(final.rows[0]?.attempts)).toBe(2);
        expect([...state.calls.values()].reduce((sum, count) => sum + count, 0)).toBe(2);
      } else {
        expect(Number(final.rows[0]?.attempts)).toBe(0);
        expect(state.calls.size).toBe(0);
      }
    } finally {
      store.close();
    }
  });

  it.each(['unauthorized_privilege_change', 'disallowed_country_login', 'unknown_device_login'] as const)(
    'expires a suspended %s approval with zero effects',
    async kind => {
      const database = await setupDatabase(kind);
      let now = '2026-08-28T10:01:00.000Z';
      const clock: Clock = { now: () => now };
      const state: LocalContainmentState = {
        sessions: new Map([['session-1', 'active']]),
        roles: new Map([['subject-1', 'admin']]),
        devices: new Map([['device-new-1', 'clear']]),
        reauthentication: new Map(),
        calls: new Map(),
      };
      const definition = createResponseWorkflow(database, clock, state, new LocalIncidentProvider());
      const runtime = new Mastra({
        storage: new LibSQLStore({
          id: `response-expiry-${kind}`,
          url: database.url,
        }),
        workflows: { responseWorkflow: definition },
      });
      const workflow = runtime.getWorkflow('responseWorkflow');
      const run = await workflow.createRun({ runId: 'workflow-run-1' });
      expect((await run.start({ inputData: workflowInput })).status).toBe('suspended');
      const store = database.createStore();
      try {
        now = '2026-08-28T10:16:00.000Z';
        let terminal: unknown;
        const dispatcher = new ApprovalRecoveryWorker({
          store,
          provider: new LocalIncidentProvider(),
          clock,
          ids: sequenceIdGenerator(['expiry-timeline', 'expiry-outbox']),
          reconcileApprovalRun: async input => {
            const result = await createWorkflowApprovalRunReconciler(workflow as unknown as ApprovalWorkflow)(input);
            terminal = await workflow.getWorkflowRunById('workflow-run-1', {
              fields: ['result'],
            });
            return result;
          },
        });
        await expect(dispatcher.runOnce()).resolves.toMatchObject({
          expired: 1,
        });
        expect(terminal).toMatchObject({
          status: 'success',
          result: { status: 'expired' },
        });
        const result = await store.execute({
          sql: `SELECT i.status,
          (SELECT count(*) FROM containment_action_attempts) AS attempts
          FROM incidents i WHERE i.id = 'incident-1'`,
        });
        expect(result.rows[0]).toMatchObject({ status: 'failed', attempts: 0 });
        expect(state.calls.size).toBe(0);
      } finally {
        store.close();
      }
    },
  );

  it('reconciles an expiry after resume completed but before its marker was stored', async () => {
    const database = await setupDatabase('unauthorized_privilege_change');
    let now = '2026-08-28T10:01:00.000Z';
    const clock: Clock = { now: () => now };
    const state: LocalContainmentState = {
      sessions: new Map([['session-1', 'active']]),
      roles: new Map([['subject-1', 'admin']]),
      devices: new Map(),
      reauthentication: new Map(),
      calls: new Map(),
    };
    const definition = createResponseWorkflow(database, clock, state, new LocalIncidentProvider());
    const runtime = new Mastra({
      storage: new LibSQLStore({
        id: 'response-expiry-reconcile',
        url: database.url,
      }),
      workflows: { responseWorkflow: definition },
    });
    const workflow = runtime.getWorkflow('responseWorkflow');
    const run = await workflow.createRun({ runId: 'workflow-run-1' });
    expect((await run.start({ inputData: workflowInput })).status).toBe('suspended');
    const store = database.createStore();
    try {
      const approval = await store.execute({
        sql: "SELECT id FROM approvals WHERE incident_id = 'incident-1'",
      });
      const approvalId = String(approval.rows[0]?.id);
      now = '2026-08-28T10:16:00.000Z';
      await expirePendingApproval(
        store,
        {
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          approvalId,
          workflowRunId: 'workflow-run-1',
          correlationId: 'expiry-reconcile',
        },
        {
          clock,
          ids: sequenceIdGenerator(['expiry-timeline', 'expiry-outbox']),
        },
      );
      let resumeCalls = 0;
      const reconciler = createApprovalRunReconciler({
        read: workflowRunId =>
          workflow.getWorkflowRunById(workflowRunId, {
            fields: ['steps', 'result'],
          }),
        resume: async ({ resumeReceiptId }) => {
          resumeCalls += 1;
          return run.resume({
            step: 'await-approval',
            resumeData: { resumeReceiptId },
          });
        },
      });
      await expect(
        reconciler({
          workflowRunId: 'workflow-run-1',
          resumeReceiptId: `expiry_${approvalId}`,
          expectedResultStatuses: ['expired'],
        }),
      ).resolves.toBe('completed');
      expect(resumeCalls).toBe(1);
      const beforeRestart = await store.execute({
        sql: 'SELECT expiry_resumed_at FROM approvals WHERE id = ?',
        args: [approvalId],
      });
      expect(beforeRestart.rows[0]?.expiry_resumed_at).toBeNull();
      const restarted = new ApprovalRecoveryWorker({
        store,
        provider: new LocalIncidentProvider(),
        clock,
        reconcileApprovalRun: reconciler,
      });
      await expect(restarted.runOnce()).resolves.toMatchObject({ expired: 1 });
      expect(resumeCalls).toBe(1);
      const marked = await store.execute({
        sql: 'SELECT expiry_resumed_at FROM approvals WHERE id = ?',
        args: [approvalId],
      });
      expect(marked.rows[0]?.expiry_resumed_at).toBe(now);
    } finally {
      store.close();
    }
  });

  it('reconciles a decided run after resume completed but before token marking', async () => {
    const database = await setupDatabase('unauthorized_privilege_change');
    let now = '2026-08-28T10:01:00.000Z';
    const clock: Clock = { now: () => now };
    const state: LocalContainmentState = {
      sessions: new Map([['session-1', 'active']]),
      roles: new Map([['subject-1', 'admin']]),
      devices: new Map(),
      reauthentication: new Map(),
      calls: new Map(),
    };
    const definition = createResponseWorkflow(database, clock, state, new LocalIncidentProvider());
    const runtime = new Mastra({
      storage: new LibSQLStore({
        id: 'response-decision-reconcile',
        url: database.url,
      }),
      workflows: { responseWorkflow: definition },
    });
    const workflow = runtime.getWorkflow('responseWorkflow');
    const run = await workflow.createRun({ runId: 'workflow-run-1' });
    expect((await run.start({ inputData: workflowInput })).status).toBe('suspended');
    const store = database.createStore();
    try {
      const current = await store.execute({
        sql: `SELECT i.version, a.id, a.plan_id, a.plan_hash
          FROM incidents i JOIN approvals a
            ON a.tenant_id = i.tenant_id AND a.incident_id = i.id
          WHERE i.id = 'incident-1'`,
      });
      const row = current.rows[0]!;
      now = '2026-08-28T10:02:00.000Z';
      const issued = await decideApprovalAndIssueResumeToken(
        store,
        {
          decision: {
            schemaVersion: 1,
            approvalId: String(row.id),
            planId: String(row.plan_id),
            incidentId: 'incident-1',
            tenantId: 'tenant-1',
            planHashVersion: 1,
            planHash: String(row.plan_hash),
            decision: 'rejected',
            reason: 'More evidence is required.',
            decidedBy: 'studio-soc-manager',
            decidedByRole: 'soc_manager',
            decidedAt: now,
          },
          expectedIncidentVersion: Number(row.version),
          runId: 'workflow-run-1',
          correlationId: 'decision-reconcile',
          resumeSecret: 'resume-secret-'.padEnd(40, 'x'),
        },
        {
          clock,
          ids: sequenceIdGenerator(['decision-timeline', 'decision-outbox']),
        },
      );
      const authorized = await authorizeResumeToken(
        store,
        {
          token: issued.resumeToken,
          tenantId: 'tenant-1',
          incidentId: 'incident-1',
          workflowRunId: 'workflow-run-1',
          approvalId: String(row.id),
        },
        { clock },
      );
      let resumeCalls = 0;
      const reconciler = createApprovalRunReconciler({
        read: workflowRunId =>
          workflow.getWorkflowRunById(workflowRunId, {
            fields: ['steps', 'result'],
          }),
        resume: async ({ resumeReceiptId }) => {
          resumeCalls += 1;
          return run.resume({
            step: 'await-approval',
            resumeData: { resumeReceiptId },
          });
        },
      });
      await expect(
        reconciler({
          workflowRunId: 'workflow-run-1',
          resumeReceiptId: authorized.resumeReceiptId,
          expectedResultStatuses: ['rejected'],
        }),
      ).resolves.toBe('completed');
      expect(resumeCalls).toBe(1);
      const unmarked = await store.execute({
        sql: 'SELECT resumed_at FROM approval_resume_tokens WHERE id = ?',
        args: [authorized.resumeReceiptId],
      });
      expect(unmarked.rows[0]?.resumed_at).toBeNull();
      const restarted = new ApprovalRecoveryWorker({
        store,
        provider: new LocalIncidentProvider(),
        clock,
        reconcileApprovalRun: reconciler,
      });
      await expect(restarted.runOnce()).resolves.toMatchObject({ resumed: 1 });
      expect(resumeCalls).toBe(1);
      const marked = await store.execute({
        sql: 'SELECT resumed_at FROM approval_resume_tokens WHERE id = ?',
        args: [authorized.resumeReceiptId],
      });
      expect(marked.rows[0]?.resumed_at).toBe(now);
    } finally {
      store.close();
    }
  });
});

async function setupDatabase(kind: IncidentKind) {
  const database = await createTempDatabase();
  databases.push(database);
  const store = database.createStore();
  await migrateOperationalStore(store);
  const vector = new LibSqlRunbookVectorStore({ url: database.url });
  try {
    for (const [index, runbook] of (await loadRunbooks(runbookRoot)).entries()) {
      await indexRunbook(store, vector, new DeterministicRunbookEmbedder(), runbook, {
        generationId: `response-generation-${index + 1}`,
        now: '2026-08-28T09:59:00.000Z',
      });
    }
    await createIncidentFromAlert(
      store,
      makeAlert({
        kind,
        sessionId: 'session-1',
        ...(kind === 'unknown_device_login' ? { deviceId: 'device-new-1' } : {}),
        ...(kind === 'disallowed_country_login' ? { ip: '198.51.100.8' } : {}),
      }),
      {
        correlationId: 'correlation-1',
        clock: fixedClock('2026-08-28T10:00:00.000Z'),
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
      },
    );
  } finally {
    store.close();
    await vector.close();
  }
  return database;
}

function createResponseWorkflow(
  database: TempDatabase,
  clock: Clock,
  state: LocalContainmentState,
  provider: LocalIncidentProvider,
  cloudProvider: LocalCloudEvidenceProvider = new LocalCloudEvidenceProvider(),
  responseOverrides: Readonly<{
    studioLocalDecisions?: boolean;
    fixtureInputs?: boolean;
    mode?: 'local' | 'staging' | 'production';
    identityProvider?: IdentityProvider;
  }> = {},
) {
  return createConfiguredSecurityIncidentWorkflow({
    openStore: () => database.createStore(),
    retrieval: {
      openVectorStore: () => new LibSqlRunbookVectorStore({ url: database.url }),
      embedder: new DeterministicRunbookEmbedder(),
      retrieve: (store, vector, embedder, input) =>
        retrieveRunbook(store, vector, embedder, input, {
          threshold: -1,
          topK: 3,
          clock: responseOverrides.fixtureInputs ? clock : fixedClock('2026-08-28T10:00:45.000Z'),
        }),
    },
    evidence: {
      identityProvider: new LocalIdentityEvidenceProvider(),
      endpointProvider: new LocalEndpointEvidenceProvider({
        verifyDeviceSignature: input =>
          input.deviceId === 'device-new-1' ||
          (responseOverrides.fixtureInputs === true && input.deviceId === 'studio-demo-new-device'),
      }),
      cloudProvider,
      clock: responseOverrides.fixtureInputs ? clock : fixedClock('2026-08-28T10:00:30.000Z'),
      supervisor: async () => ({
        scopeValidated: true,
        specialists: ['identity', 'endpoint', 'cloud'],
      }),
      identityInvestigator: deterministicInvestigator,
      endpointInvestigator: deterministicInvestigator,
      cloudInvestigator: deterministicInvestigator,
      correlationAnalyst: async ({ candidate }) => candidate,
    },
    triage: { planner: deterministicResponsePlanner, runbookRoot },
    response: {
      enabled: true,
      provider,
      state,
      mode: responseOverrides.mode ?? 'local',
      studioLocalDecisions: responseOverrides.studioLocalDecisions,
      allowWebhookInput: responseOverrides.fixtureInputs,
      timeoutMs: 1_000,
      rateLimit: 8,
      clock,
      ...(responseOverrides.identityProvider ? { identityProvider: responseOverrides.identityProvider } : {}),
    },
  });
}

const unusedIdentityProvider: IdentityProvider = {
  getUser: async () => {
    throw new Error('not called before approval');
  },
  listSessions: async () => {
    throw new Error('not called before approval');
  },
  revokeSession: async () => {
    throw new Error('not called before approval');
  },
  restoreRole: async () => {
    throw new Error('not called before approval');
  },
};

const workflowInput = {
  eventId: 'workflow-run-1',
  incidentId: 'incident-1',
  tenantId: 'tenant-1',
  alertId: 'alert-1',
  correlationId: 'correlation-1',
};

const deterministicInvestigator = async (input: { facts: readonly { factToken: string }[] }) => ({
  citedFactTokens: input.facts.map(fact => fact.factToken),
  gaps: [],
  contradictionFlags: [],
});
