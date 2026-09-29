import { setTimeout as delay } from 'node:timers/promises';
import type { Event } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import type { OperationalStore } from '../../src/db/operational-store.js';
import { CorrelationSchema } from '../../src/evidence/contracts.js';
import { InProcessDomainPubSub } from '../../src/workers/in-process-domain-pubsub.js';
import { OutboxDispatcher } from '../../src/workers/outbox-dispatcher.js';
import { startWorkflowWorker } from '../../src/workers/workflow-worker.js';
import { LocalIncidentProvider } from '../../src/providers/local-incident-provider.js';
import { safeContainment } from '../../src/mastra/evals/workflow-safety.js';
import type { WorkflowCase } from '../../src/mastra/evals/workflow-corpus.js';
import { prepareLocalWorkflowDatabase } from '../evals/local-database.js';
import { createLocalWorkflowDefinition } from '../evals/local-definition.js';
import { resolveLocalApproval } from '../evals/local-approval.js';
import { observeWorkflow } from '../evals/observe-workflow.js';
import { demoOutboxOptions, silentDemoLogger } from './webhook-intake.js';
import { ingestDemoWithRecovery } from './intake-recovery.js';

export async function runLocalDemoCase(testCase: WorkflowCase, directory: string) {
  const database = await prepareLocalWorkflowDatabase(directory, testCase.id);
  const { scope, intake } = await ingestDemoWithRecovery(database.openStore, testCase.kind);
  let store: OperationalStore | undefined;
  let storage: LibSQLStore | undefined;
  const pubsub = new InProcessDomainPubSub({ retryDelayMs: 1 });
  let stopWorker = async () => {};
  try {
    store = database.openStore();
    let now = '2026-08-28T10:01:00.000Z';
    const clock = { now: () => now };
    const provider = new LocalIncidentProvider({
      openStore: database.openStore,
    });
    const definition = createLocalWorkflowDefinition(database.url, clock, false, provider);
    storage = new LibSQLStore({
      id: `demo-${testCase.id}`,
      url: database.url,
    });
    const runtime = new Mastra({
      storage,
      workflows: { securityIncidentWorkflow: definition },
    });
    const workflow = runtime.getWorkflow('securityIncidentWorkflow');
    let run: Awaited<ReturnType<typeof workflow.createRun>> | undefined;
    let starts = 0;
    let nativeStarts = 0;
    let delivery: Event | undefined;
    await pubsub.subscribe('security.alert.received', async (event, ack) => {
      delivery = event;
      await ack?.();
    });
    stopWorker = await startWorkflowWorker({
      pubsub,
      store,
      logger: silentDemoLogger,
      maxAttempts: 3,
      workflow: {
        createRun: async options => {
          starts++;
          const created = await workflow.createRun(options);
          run = created;
          return {
            startAsync: async input => {
              nativeStarts++;
              return created.startAsync(input);
            },
          };
        },
      },
    });
    const dispatcher = new OutboxDispatcher(
      store,
      pubsub,
      demoOutboxOptions,
      silentDemoLogger,
      () => new Date('2026-08-28T10:00:01.000Z'),
    );
    await dispatcher.runOnce();
    const suspended = await waitForSuspension(() =>
      workflow.getWorkflowRunById(scope.workflowRunId, {
        fields: ['steps', 'result'],
      }),
    );
    const correlation = z.object({ output: CorrelationSchema }).parse(suspended.steps?.['correlate-events']).output;
    const before = await store.execute({
      sql: 'SELECT count(*) AS count FROM local_containment_effects WHERE tenant_id=? AND incident_id=?',
      args: [scope.tenantId, scope.incidentId],
    });
    if (before.rows[0]?.count !== 0 || !run || !delivery) throw new Error('DEMO_PREAPPROVAL_BOUNDARY_FAILED');
    const resolution = await resolveLocalApproval(
      store,
      'approved',
      clock,
      value => {
        now = value;
      },
      scope,
    );
    const result = await run.resume({
      step: 'await-approval',
      resumeData: { resumeReceiptId: resolution.receipt },
    });
    const probes = await resolution.checkReplay();
    // A second transport publication has a new transport id but the same durable
    // data.eventId; the committed consumer ledger must suppress a second start.
    await pubsub.publish('security.alert.received', delivery);
    const observation = await observeWorkflow(store, testCase.id, correlation, database.runbooks, {
      startStatus: suspended.status,
      finalStatus: result.status,
      responseStatus: result.status === 'success' ? String(result.result.status) : 'failed',
      preApprovalEffects: Number(before.rows[0]?.count),
      authorizationProbes: [...resolution.probes, ...probes],
    });
    const external = await store.execute({
      sql: 'SELECT operation,projection_json FROM local_incident_provider_effects WHERE tenant_id=? AND incident_id=? ORDER BY generation',
      args: [scope.tenantId, scope.incidentId],
    });
    const published = await store.execute({
      sql: 'SELECT published_at FROM outbox_events WHERE id=?',
      args: [scope.eventId],
    });
    if (
      !safeContainment(observation) ||
      starts !== 1 ||
      nativeStarts !== 1 ||
      !published.rows[0]?.published_at ||
      !external.rows.some(row => row.operation === 'create') ||
      !external.rows.some(row => row.operation === 'update')
    )
      throw new Error('DEMO_FINAL_VERIFICATION_FAILED');
    return {
      schemaVersion: 1,
      caseId: testCase.id,
      kind: testCase.kind,
      tenantId: scope.tenantId,
      incidentId: scope.incidentId,
      workflowRunId: scope.workflowRunId,
      ...intake,
      recoveredAfterTransportRestart: true,
      nativeStartAsyncCalls: nativeStarts,
      workflowCreateRunCalls: starts,
      duplicateDeliveryStarts: starts - 1,
      beforeApprovalEffects: observation.preApprovalEffects,
      severity: observation.severity,
      status: observation.incidentStatus,
      outcome: observation.responseStatus,
      verifiedEffects: observation.authority.effects.length,
      authorizationProbes: observation.authorizationProbes,
      externalOperations: external.rows.map(row => row.operation),
      database: `${testCase.id}.db`,
      passed: true,
    };
  } finally {
    await stopWorker();
    await pubsub.close();
    store?.close();
    await storage?.close();
  }
}

async function waitForSuspension<T extends { status: string }>(read: () => Promise<T | null>): Promise<T> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const state = await read();
    if (state?.status === 'suspended') return state;
    if (state && ['success', 'failed', 'canceled'].includes(state.status))
      throw new Error(`DEMO_UNEXPECTED_WORKFLOW_STATE:${state.status}`);
    await delay(20);
  }
  throw new Error('DEMO_WORKFLOW_TIMEOUT');
}
