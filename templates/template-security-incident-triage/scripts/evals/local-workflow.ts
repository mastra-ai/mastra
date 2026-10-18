import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { createIncidentFromAlert } from '../../src/db/incident-operations.js';
import { fixedClock } from '../../src/domain/clock.js';
import { sequenceIdGenerator } from '../../src/domain/id-generator.js';
import { CorrelationSchema } from '../../src/evidence/contracts.js';
import { prepareLocalWorkflowDatabase } from './local-database.js';
import { createLocalWorkflowDefinition } from './local-definition.js';
import type { WorkflowCase } from '../../src/mastra/evals/workflow-corpus.js';
import { resolveLocalApproval } from './local-approval.js';
import { observeWorkflow } from './observe-workflow.js';

export const localWorkflowInput = {
  eventId: 'workflow-run-1',
  incidentId: 'incident-1',
  tenantId: 'tenant-1',
  alertId: 'alert-1',
  correlationId: 'correlation-1',
};

/** Only call with a new, caller-owned directory. No environment/provider keys. */
export async function runLocalWorkflow(testCase: WorkflowCase, directory: string) {
  const { url, openStore, runbooks } = await prepareLocalWorkflowDatabase(directory, testCase.id);
  const store = openStore();
  try {
    await createIncidentFromAlert(
      store,
      {
        schemaVersion: 1,
        alertId: 'alert-1',
        source: 'workos',
        sourceEventId: 'source-event-1',
        kind: testCase.kind,
        occurredAt: '2026-08-27T12:00:00.000Z',
        tenantId: 'tenant-1',
        subjectId: 'subject-1',
        actor: { id: 'actor-1', type: 'user' },
        target: { id: 'subject-1', type: 'user' },
        changes: { previousRole: 'member', nextRole: 'admin' },
        rawPayloadRef: 'protected://synthetic/eval',
        idempotencyKey: 'eval-alert-1',
        sessionId: 'session-1',
        ...(testCase.kind === 'unknown_device_login' ? { deviceId: 'device-new-1' } : {}),
        ...(testCase.kind === 'disallowed_country_login' ? { ip: '198.51.100.8' } : {}),
      },
      {
        correlationId: 'correlation-1',
        clock: fixedClock('2026-08-28T10:00:00.000Z'),
        ids: sequenceIdGenerator(['incident-1', 'timeline-1', 'outbox-1']),
      },
    );
  } finally {
    store.close();
  }
  let now = '2026-08-28T10:01:00.000Z';
  const clock = { now: () => now };
  const definition = createLocalWorkflowDefinition(url, clock, testCase.decision === 'benign');
  const storage = new LibSQLStore({ id: `eval-${testCase.id}`, url });
  const runtime = new Mastra({
    storage,
    workflows: { securityIncidentWorkflow: definition },
  });
  const db = openStore();
  try {
    const run = await runtime.getWorkflow('securityIncidentWorkflow').createRun({ runId: 'workflow-run-1' });
    const started = await run.start({ inputData: localWorkflowInput });
    const correlationStep = started.steps['correlate-events'];
    if (!correlationStep || correlationStep.status !== 'success') throw new Error('EVAL_CORRELATION_MISSING');
    const correlation = CorrelationSchema.parse(correlationStep.output);
    const before = await db.execute({
      sql: 'SELECT count(*) AS count FROM local_containment_effects',
    });
    const resolution = await resolveLocalApproval(db, testCase.decision, clock, value => {
      now = value;
    });
    const result = resolution.receipt
      ? await run.resume({
          step: 'await-approval',
          resumeData: { resumeReceiptId: resolution.receipt },
        })
      : started;
    const replayBlocked = await resolution.checkReplay();
    return await observeWorkflow(db, testCase.id, correlation, runbooks, {
      startStatus: started.status,
      finalStatus: result.status,
      responseStatus: result.status === 'success' ? String(result.result.status) : 'failed',
      preApprovalEffects: Number(before.rows[0]?.count),
      authorizationProbes: [...resolution.probes, ...replayBlocked],
    });
  } finally {
    db.close();
    await storage.close();
  }
}
