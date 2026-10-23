import { resolve } from 'node:path';

import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import { TestExporter } from '@mastra/observability';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createIncidentFromAlert } from '../../src/db/incident-operations.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { fixedClock } from '../../src/domain/clock.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { createSecurityIncidentWorkflow } from '../../src/mastra/workflows/security-incident-workflow.js';
import { LocalCloudEvidenceProvider } from '../../src/providers/cloud-evidence-provider.js';
import { LocalEndpointEvidenceProvider } from '../../src/providers/endpoint-evidence-provider.js';
import { LocalIdentityEvidenceProvider } from '../../src/providers/identity-evidence-provider.js';
import type {
  CloudEvidenceProvider,
  EndpointEvidenceProvider,
  IdentityEvidenceProvider,
  ReadOnlyEvidenceProvider,
} from '../../src/providers/evidence-provider.js';
import { DeterministicRunbookEmbedder } from '../../src/mastra/knowledge/embeddings.js';
import { indexRunbook } from '../../src/mastra/knowledge/indexer.js';
import { loadRunbooks } from '../../src/mastra/knowledge/loader.js';
import { retrieveRunbook } from '../../src/mastra/knowledge/retrieve.js';
import { LibSqlRunbookVectorStore } from '../../src/mastra/knowledge/vector-store.js';
import type { IncidentKind } from '../../src/schemas/incident.js';
import { deterministicResponsePlanner } from '../../src/triage/prompt-safe-decision.js';
import { loadDecisionContext } from '../../src/triage/decision-context.js';
import {
  CorrelationSchema,
  EvidenceProviderResultSchema,
  type EvidenceSourceV1,
} from '../../src/evidence/contracts.js';
import { RunbookRetrievedSchema } from '../../src/mastra/steps/retrieve-runbook.js';
import { createSecurityObservability } from '../../src/mastra/observability.js';
import { makeAlert } from '../fixtures/domain.js';
import { createTempDatabase, type TempDatabase } from '../helpers/temp-libsql.js';

const databases: TempDatabase[] = [];
const runbookRoot = resolve(process.cwd(), 'runbooks');

afterEach(async () => {
  await Promise.all(databases.splice(0).map(database => database.cleanup()));
});

describe('triage workflow', () => {
  it('validates country triage with the default runbook path while Studio cwd is public', async () => {
    const database = await setupDatabase('disallowed_country_login');
    const studioDirectory = resolve('src/mastra/public');
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(studioDirectory);
    try {
      const workflow = createTriageWorkflow(database, deterministicResponsePlanner, {}, true);
      const run = await workflow.createRun({ runId: 'workflow-run-1' });
      const result = await run.start({ inputData: workflowInput });
      expect(result).toMatchObject({
        status: 'success',
        result: {
          status: 'ready-for-approval',
          decision: { severity: 'medium' },
        },
      });
    } finally {
      cwd.mockRestore();
    }
  });
  it.each([
    ['unauthorized_privilege_change', 'high', ['restore_previous_role', 'revoke_session']],
    ['disallowed_country_login', 'medium', ['require_reauthentication', 'revoke_session']],
    ['unknown_device_login', 'medium', ['mark_device_for_review', 'revoke_session']],
  ] as const)('produces a validated, non-executable result for %s', async (kind, severity, actionTypes) => {
    const database = await setupDatabase(kind);
    const planner = vi.fn(deterministicResponsePlanner);
    const workflow = createTriageWorkflow(database, planner);
    const run = await workflow.createRun({ runId: 'workflow-run-1' });
    const result = await run.start({ inputData: workflowInput });
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.result).toMatchObject({
      status: 'ready-for-approval',
      decision: { severity, policyVersion: 1 },
      plan: {
        planHashVersion: 1,
        actions: actionTypes.map(type => ({ type })),
      },
    });
    expect(result.result.status).toBe('ready-for-approval');
    if (result.result.status !== 'ready-for-approval') return;
    if (kind === 'disallowed_country_login')
      expect(JSON.stringify(result.result.summary)).not.toMatch(/device|authorized-device/iu);
    expect(result.result.plan.actions).toHaveLength(2);
    expect(planner).toHaveBeenCalledTimes(2);
    expect(planner.mock.calls.map(([request]) => request.task)).toEqual(['severity', 'containment']);

    const verification = database.createStore();
    try {
      const forbidden = await verification.execute({
        sql: `SELECT
          (SELECT count(*) FROM containment_plans) AS plans,
          (SELECT count(*) FROM containment_actions) AS actions,
          (SELECT count(*) FROM approvals) AS approvals,
          (SELECT count(*) FROM outbox_events WHERE type = 'security.approval.requested') AS approval_outbox,
          (SELECT count(*) FROM timeline_events WHERE type LIKE 'triage.%') AS triage_events`,
      });
      expect(forbidden.rows[0]).toEqual({
        plans: 0,
        actions: 0,
        approvals: 0,
        approval_outbox: 0,
        triage_events: 4,
      });
      const incident = await verification.execute({
        sql: "SELECT status, current_plan_id FROM incidents WHERE id = 'incident-1'",
      });
      expect(incident.rows[0]).toEqual({
        status: 'investigating',
        current_plan_id: null,
      });
      const timeline = await verification.execute({
        sql: "SELECT payload_json FROM timeline_events WHERE type LIKE 'triage.%' ORDER BY sequence",
      });
      const serialized = JSON.stringify(timeline.rows);
      expect(serialized).not.toMatch(/subject-1|session-1|device-new-1|protected:|synthetic-admin/iu);
    } finally {
      verification.close();
    }
  });

  it('fails closed before the planner when persisted evidence is tampered', async () => {
    const database = await setupDatabase('unauthorized_privilege_change');
    const planner = vi.fn(deterministicResponsePlanner);
    const first = createTriageWorkflow(database, planner);
    const firstRun = await first.createRun({ runId: 'workflow-run-1' });
    expect((await firstRun.start({ inputData: workflowInput })).status).toBe('success');
    const store = database.createStore();
    await store.execute({
      sql: 'UPDATE evidence_items SET confidence = 0.5 WHERE id = (SELECT id FROM evidence_items ORDER BY id LIMIT 1)',
    });
    await store.execute({
      sql: "DELETE FROM timeline_events WHERE type LIKE 'triage.%'",
    });
    store.close();
    const before = planner.mock.calls.length;
    const second = createTriageWorkflow(database, planner);
    const secondRun = await second.createRun({ runId: 'workflow-run-2' });
    const result = await secondRun.start({ inputData: workflowInput });
    expect(result.status).not.toBe('success');
    expect(planner.mock.calls.length).toBe(before);
  });

  it.each([
    ['unauthorized_privilege_change', 'role.previous', 'admin'],
    ['disallowed_country_login', 'login.country', 'US'],
    ['unknown_device_login', 'device.authorized', true],
  ] as const)('stops a benign %s before producing any containment plan', async (kind, factType, value) => {
    const database = await setupDatabase(kind);
    const planner = vi.fn(deterministicResponsePlanner);
    const providers = {
      identityProvider:
        kind === 'unauthorized_privilege_change'
          ? overrideFact(new LocalIdentityEvidenceProvider(), factType, value)
          : new LocalIdentityEvidenceProvider(),
      cloudProvider:
        kind === 'disallowed_country_login'
          ? overrideFact(
              new LocalCloudEvidenceProvider({
                includeSessionHistory: false,
              }),
              factType,
              value,
            )
          : new LocalCloudEvidenceProvider(),
      endpointProvider:
        kind === 'unknown_device_login'
          ? overrideFact(mockEndpointWithFixtureAuthority(), factType, value)
          : new LocalEndpointEvidenceProvider(),
    };
    const workflow = createTriageWorkflow(database, planner, providers);
    const run = await workflow.createRun({ runId: 'workflow-run-1' });
    const result = await run.start({ inputData: workflowInput });
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.result).toEqual({
      status: 'benign',
      incidentId: 'incident-1',
      reasonCodes: ['BENIGN_EXPLANATION'],
    });
    expect(planner).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown country', [['login.country', 'ZZ']]],
    [
      'provider-redefined allowlist',
      [
        ['login.country', 'US'],
        ['policy.allowedCountry', 'CA'],
      ],
    ],
  ] as const)('stops a disallowed-country policy bypass from %s before the planner', async (_label, overrides) => {
    const database = await setupDatabase('disallowed_country_login');
    const planner = vi.fn(deterministicResponsePlanner);
    const cloudProvider = overrides.reduce<CloudEvidenceProvider>(
      (provider, [factType, value]) => overrideFact(provider, factType, value),
      new LocalCloudEvidenceProvider(),
    );
    const workflow = createTriageWorkflow(database, planner, {
      cloudProvider,
    });
    const run = await workflow.createRun({ runId: 'workflow-run-1' });
    const result = await run.start({ inputData: workflowInput });
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.result).toEqual({
      status: 'manual-review',
      incidentId: 'incident-1',
      reasonCodes: ['REQUIRED_EVIDENCE_INCOMPLETE'],
    });
    expect(planner).not.toHaveBeenCalled();
  });

  it('stops an invalid device signature before planning or persistence', async () => {
    const database = await setupDatabase('unknown_device_login');
    const planner = vi.fn(deterministicResponsePlanner);
    const endpointProvider = overrideFact(
      overrideFact(new LocalEndpointEvidenceProvider(), 'device.authorized', true),
      'device.signatureValid',
      false,
    );
    const workflow = createTriageWorkflow(database, planner, {
      endpointProvider,
    });
    const run = await workflow.createRun({ runId: 'workflow-run-1' });
    const result = await run.start({ inputData: workflowInput });
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.result).toEqual({
      status: 'manual-review',
      incidentId: 'incident-1',
      reasonCodes: ['REQUIRED_EVIDENCE_INCOMPLETE'],
    });
    expect(planner).not.toHaveBeenCalled();

    const store = database.createStore();
    try {
      const rows = await store.execute({
        sql: `SELECT
          (SELECT count(*) FROM containment_plans) AS plans,
          (SELECT count(*) FROM containment_actions) AS actions,
          (SELECT count(*) FROM approvals) AS approvals`,
      });
      expect(rows.rows).toEqual([{ plans: 0, actions: 0, approvals: 0 }]);
    } finally {
      store.close();
    }
  });

  it('produces identical plan bytes and hash when the planner reverses equivalent actions', async () => {
    const baselineDatabase = await setupDatabase('disallowed_country_login');
    const reorderedDatabase = await setupDatabase('disallowed_country_login');
    const reorderedPlanner: typeof deterministicResponsePlanner = async request =>
      request.task === 'containment'
        ? {
            ...request.candidate,
            actions: [...request.candidate.actions].reverse(),
          }
        : request.candidate;
    const baselineWorkflow = createTriageWorkflow(baselineDatabase, deterministicResponsePlanner);
    const reorderedWorkflow = createTriageWorkflow(reorderedDatabase, reorderedPlanner);
    const baselineRun = await baselineWorkflow.createRun({
      runId: 'workflow-run-1',
    });
    const reorderedRun = await reorderedWorkflow.createRun({
      runId: 'workflow-run-1',
    });
    const baseline = await baselineRun.start({ inputData: workflowInput });
    const reordered = await reorderedRun.start({ inputData: workflowInput });
    expect(baseline.status).toBe('success');
    expect(reordered.status).toBe('success');
    if (baseline.status !== 'success' || reordered.status !== 'success') return;
    expect(baseline.result.status).toBe('ready-for-approval');
    expect(reordered.result.status).toBe('ready-for-approval');
    if (baseline.result.status !== 'ready-for-approval' || reordered.result.status !== 'ready-for-approval') return;
    expect(JSON.stringify(reordered.result.plan)).toBe(JSON.stringify(baseline.result.plan));
    expect(reordered.result.plan.planId).toBe(baseline.result.plan.planId);
    expect(reordered.result.plan.planHash).toBe(baseline.result.plan.planHash);
    expect(reordered.result.plan.actions.map(item => item.actionId)).toEqual(
      baseline.result.plan.actions.map(item => item.actionId),
    );
  });

  it('exports the completed triage graph without raw decision payloads', async () => {
    const database = await setupDatabase('unknown_device_login');
    const exporter = new TestExporter({
      logMetricsOnFlush: false,
      validateLifecycle: true,
    });
    const observability = createSecurityObservability([exporter]);
    const runtime = new Mastra({
      workflows: {
        securityIncidentWorkflow: createTriageWorkflow(database, deterministicResponsePlanner),
      },
      observability,
    });
    try {
      const workflow = runtime.getWorkflow('securityIncidentWorkflow');
      const run = await workflow.createRun({ runId: workflowInput.eventId });
      expect((await run.start({ inputData: workflowInput })).status).toBe('success');
      await observability.flush();
      const completed = exporter.getCompletedSpans();
      expect(completed.some(span => span.type === SpanType.WORKFLOW_RUN)).toBe(true);
      expect(completed.filter(span => span.type === SpanType.WORKFLOW_STEP).length).toBeGreaterThanOrEqual(11);
      expect(completed.every(span => span.input === undefined)).toBe(true);
      expect(completed.every(span => span.output === undefined)).toBe(true);
      const serialized = exporter.toJSON({ includeEvents: true });
      for (const forbidden of [
        'tenant-1',
        'incident-1',
        'workflow-run-1',
        'correlation-1',
        'subject-1',
        'session-1',
        'device-new-1',
        'synthetic-admin',
        'planHash',
        'prompt',
        'response',
      ])
        expect(serialized).not.toContain(forbidden);
    } finally {
      await observability.shutdown();
    }
  });

  it('revalidates tenant, alert, evidence, retrieval, activation, and full runbook readback', async () => {
    const database = await setupDatabase('unknown_device_login');
    const workflow = createTriageWorkflow(database, deterministicResponsePlanner);
    const run = await workflow.createRun({ runId: 'workflow-run-1' });
    const result = await run.start({ inputData: workflowInput });
    expect(result.status).toBe('success');
    const correlationStep = result.steps['correlate-events'];
    const retrievalStep = result.steps['retrieve-runbook'];
    expect(correlationStep?.status).toBe('success');
    expect(retrievalStep?.status).toBe('success');
    if (correlationStep?.status !== 'success' || retrievalStep?.status !== 'success') return;
    const correlation = CorrelationSchema.parse(correlationStep.output);
    const retrieval = RunbookRetrievedSchema.parse(retrievalStep.output);
    const store = database.createStore();
    try {
      await expect(loadDecisionContext(store, retrieval, correlation, { runbookRoot })).resolves.toMatchObject({
        allowedActions: ['revoke_session', 'mark_device_for_review'],
      });

      await expect(
        loadDecisionContext(
          store,
          retrieval,
          {
            ...correlation,
            context: { ...correlation.context, tenantId: 'tenant-cross-scope' },
          },
          { runbookRoot },
        ),
      ).rejects.toBeDefined();

      for (const changedContext of [
        {
          ...correlation,
          context: {
            ...correlation.context,
            incidentId: 'incident-cross-scope',
          },
        },
        {
          ...correlation,
          context: {
            ...correlation.context,
            workflowRunId: 'workflow-run-cross-scope',
          },
        },
        {
          ...correlation,
          context: {
            ...correlation.context,
            alertId: 'alert-cross-scope',
          },
        },
      ])
        await expect(
          loadDecisionContext(store, retrieval, changedContext, {
            runbookRoot,
          }),
        ).rejects.toBeDefined();

      const identityBranch = correlation.branches.find(branch => branch.source === 'identity')!;
      const cloudBranch = correlation.branches.find(branch => branch.source === 'cloud')!;
      const reassignedEvidenceId = identityBranch.evidenceIds[0]!;
      await expect(
        loadDecisionContext(
          store,
          retrieval,
          {
            ...correlation,
            branches: correlation.branches.map(branch =>
              branch.source === 'identity'
                ? {
                    ...branch,
                    evidenceIds: branch.evidenceIds.filter(id => id !== reassignedEvidenceId),
                  }
                : branch.source === 'cloud'
                  ? {
                      ...cloudBranch,
                      evidenceIds: [...cloudBranch.evidenceIds, reassignedEvidenceId],
                    }
                  : branch,
            ),
          },
          { runbookRoot },
        ),
      ).rejects.toBeDefined();

      for (const changedRetrieval of [
        {
          ...retrieval,
          citation: '[runbook:RB-IDENTITY-003@9.9.9]',
        },
        { ...retrieval, generationId: 'generation-forged' },
        { ...retrieval, chunkIds: ['chunk-forged'] },
      ])
        await expect(
          loadDecisionContext(store, changedRetrieval, correlation, {
            runbookRoot,
          }),
        ).rejects.toBeDefined();

      const evidenceId = correlation.orderedEvents[0]!.evidenceId;
      const originalEvidence = await store.execute({
        sql: 'SELECT confidence FROM evidence_items WHERE id = ?',
        args: [evidenceId],
      });
      const originalConfidence = Number(originalEvidence.rows[0]?.confidence);
      await store.execute({
        sql: 'UPDATE evidence_items SET confidence = 0.5 WHERE id = ?',
        args: [evidenceId],
      });
      await expect(loadDecisionContext(store, retrieval, correlation, { runbookRoot })).rejects.toBeDefined();
      await store.execute({
        sql: 'UPDATE evidence_items SET confidence = ? WHERE id = ?',
        args: [originalConfidence, evidenceId],
      });

      await store.execute({
        sql: "UPDATE runbook_generations SET state = 'retired' WHERE generation_id = ?",
        args: [retrieval.generationId],
      });
      await expect(loadDecisionContext(store, retrieval, correlation, { runbookRoot })).rejects.toBeDefined();
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
        generationId: `triage-generation-${index + 1}`,
        now: '2026-08-28T11:59:00.000Z',
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
        clock: fixedClock('2026-08-28T00:00:00.000Z'),
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
      },
    );
  } finally {
    store.close();
    await vector.close();
  }
  return database;
}

function createTriageWorkflow(
  database: TempDatabase,
  planner: typeof deterministicResponsePlanner,
  providers: Readonly<{
    identityProvider?: IdentityEvidenceProvider;
    endpointProvider?: EndpointEvidenceProvider;
    cloudProvider?: CloudEvidenceProvider;
  }> = {},
  useDefaultRunbookRoot = false,
) {
  return createSecurityIncidentWorkflow(
    () => database.createStore(),
    {
      openVectorStore: () => new LibSqlRunbookVectorStore({ url: database.url }),
      embedder: new DeterministicRunbookEmbedder(),
      retrieve: (store, vector, embedder, input) =>
        retrieveRunbook(store, vector, embedder, input, {
          threshold: -1,
          topK: 3,
        }),
    },
    {
      identityProvider: providers.identityProvider ?? new LocalIdentityEvidenceProvider(),
      endpointProvider: providers.endpointProvider ?? mockEndpointWithFixtureAuthority(),
      cloudProvider: providers.cloudProvider ?? new LocalCloudEvidenceProvider(),
      clock: fixedClock('2026-08-28T10:00:30.000Z'),
      supervisor: async () => ({
        scopeValidated: true,
        specialists: ['identity', 'endpoint', 'cloud'],
      }),
      identityInvestigator: deterministicInvestigator,
      endpointInvestigator: deterministicInvestigator,
      cloudInvestigator: deterministicInvestigator,
      correlationAnalyst: async ({ candidate }) => candidate,
    },
    { planner, ...(useDefaultRunbookRoot ? {} : { runbookRoot }) },
  );
}

function mockEndpointWithFixtureAuthority() {
  return new LocalEndpointEvidenceProvider({
    verifyDeviceSignature: input => input.deviceId === 'device-new-1',
  });
}

function overrideFact<Source extends EvidenceSourceV1>(
  provider: ReadOnlyEvidenceProvider<Source>,
  factType: string,
  value: string | boolean,
): ReadOnlyEvidenceProvider<Source> {
  return {
    source: provider.source,
    providerId: provider.providerId,
    inspect: async (input, options) => {
      const result = EvidenceProviderResultSchema.parse(await provider.inspect(input, options));
      if (result.status !== 'success') return result;
      return EvidenceProviderResultSchema.parse({
        ...result,
        facts: result.facts.map(fact => (fact.factType === factType ? { ...fact, value } : fact)),
      });
    },
  };
}

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
