import { createStep } from '@mastra/core/workflows';

import { ContainmentExecutionResultSchema, IncidentResponseResultSchema } from '../../approval/contracts.js';
import { createLibSqlOperationalStore } from '../../db/libsql-operational-store.js';
import { insertTimelineAndOutbox } from '../../db/incident-operations.js';
import type { OperationalStore } from '../../db/operational-store.js';
import { canonicalTriageResult, triageResultHash } from '../../db/triage-result-operations.js';
import { systemClock, type Clock } from '../../domain/clock.js';
import { DomainError } from '../../domain/errors.js';
import { uuidGenerator, type IdGenerator } from '../../domain/id-generator.js';
import type { ContainmentExecutionResult } from '../../approval/contracts.js';
import { closeValidatedTerminalIncident } from '../../containment/terminal-readiness.js';
import type { TriageResult } from '../../triage/decision-contracts.js';
import { beginFinalizationTrace } from '../finalization-trace.js';

export function createFinalizeIncidentStep(
  dependencies: Readonly<{
    openStore?: () => OperationalStore;
    clock?: Clock;
    ids?: IdGenerator;
  }> = {},
) {
  return createStep({
    id: 'finalize-incident',
    description: 'Closes benign, rejected, or fully contained incidents and preserves failed/partial state.',
    inputSchema: ContainmentExecutionResultSchema,
    outputSchema: IncidentResponseResultSchema,
    execute: async ({ inputData, getInitData }) => {
      if (inputData.status === 'benign' || inputData.status === 'manual-review' || inputData.status === 'blocked') {
        const init = getInitData<{
          tenantId: string;
          eventId?: string;
          incidentId?: string;
          correlationId?: string;
        }>();
        const store = (dependencies.openStore ?? createLibSqlOperationalStore)();
        try {
          await finalizeTriageStop(
            store,
            {
              tenantId: init.tenantId,
              ...(init.eventId ? { expectedWorkflowRunId: init.eventId } : {}),
              ...(init.incidentId ? { expectedIncidentId: init.incidentId } : {}),
              ...(init.correlationId ? { expectedCorrelationId: init.correlationId } : {}),
              result: inputData,
            },
            dependencies,
          );
        } finally {
          store.close();
        }
        return inputData;
      }
      const store = (dependencies.openStore ?? createLibSqlOperationalStore)();
      try {
        const trace = await beginFinalizationTrace(store, {
          tenantId: inputData.plan.tenantId,
          incidentId: inputData.plan.incidentId,
          workflowRunId: inputData.workflowRunId,
          correlationId: inputData.correlationId,
        });
        if (inputData.status === 'containment-failed') {
          // Preserve failed/partial state for the existing recovery path.
          await trace.finish(false);
          return {
            status: 'failed' as const,
            incidentId: inputData.plan.incidentId,
            approvalId: inputData.authoritative.approvalId,
            partial: inputData.partial,
            outcomes: inputData.outcomes,
          };
        }
        if (inputData.status === 'expired') {
          await completeWorkflowMarker(store, inputData, dependencies.clock);
          await trace.finish(true);
          return {
            status: 'expired' as const,
            incidentId: inputData.plan.incidentId,
            approvalId: inputData.authoritative.approvalId,
          };
        }
        await closeValidatedTerminalIncident(
          store,
          {
            ...inputData,
            requestCorrelationId: inputData.correlationId,
            terminalCorrelationId: inputData.correlationId,
          },
          {
            ...(dependencies.clock ? { clock: dependencies.clock } : {}),
            ...(dependencies.ids ? { ids: dependencies.ids } : {}),
          },
        );
        await completeWorkflowMarker(store, inputData, dependencies.clock);
        const result = finalResult(inputData);
        await trace.finish(true);
        return result;
      } finally {
        store.close();
      }
    },
  });
}

/** Align the operational marker with a completed Mastra run before restart recovery. */
async function completeWorkflowMarker(
  store: OperationalStore,
  input: Readonly<{
    workflowRunId: string;
    plan: Readonly<{ incidentId: string }>;
  }>,
  clock: Clock = systemClock,
): Promise<void> {
  await store.execute({
    sql: `UPDATE workflow_runs SET status = 'completed', finished_at = ?
      WHERE run_id = ? AND incident_id = ? AND status = 'running'`,
    args: [clock.now(), input.workflowRunId, input.plan.incidentId],
  });
}

type FinalizableInput = Extract<ContainmentExecutionResult, { status: 'rejected' | 'containment-succeeded' }>;

function finalResult(input: FinalizableInput) {
  return input.status === 'rejected'
    ? {
        status: 'rejected' as const,
        incidentId: input.plan.incidentId,
        approvalId: input.authoritative.approvalId,
      }
    : {
        status: 'contained' as const,
        incidentId: input.plan.incidentId,
        approvalId: input.authoritative.approvalId,
        outcomes: input.outcomes,
      };
}

type TriageStop = Extract<TriageResult, { status: 'benign' | 'manual-review' | 'blocked' }>;

async function finalizeTriageStop(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    expectedWorkflowRunId?: string;
    expectedIncidentId?: string;
    expectedCorrelationId?: string;
    result: TriageStop;
  }>,
  dependencies: Readonly<{ clock?: Clock; ids?: IdGenerator }>,
) {
  if (input.expectedIncidentId && input.expectedIncidentId !== input.result.incidentId)
    throw new DomainError('CONFLICT');

  const clock = dependencies.clock ?? systemClock;
  const ids = dependencies.ids ?? uuidGenerator;
  const canonical = canonicalTriageResult(input.result);
  const digest = triageResultHash(canonical);

  await store.transaction(async tx => {
    const scoped = await tx.execute({
      sql: `SELECT i.status AS incident_status, i.version AS incident_version,
          i.updated_at AS incident_updated_at, i.current_run_id,
          w.status AS workflow_status, w.finished_at, w.triage_result_json,
          w.triage_result_hash, COALESCE(source.correlation_id,
            (SELECT received.correlation_id FROM outbox_events received
              WHERE received.tenant_id = i.tenant_id
                AND received.incident_id = i.id
                AND received.type = 'security.alert.received'
              ORDER BY received.occurred_at ASC LIMIT 1)) AS correlation_id
        FROM incidents i
        JOIN workflow_runs w ON w.tenant_id = i.tenant_id
          AND w.incident_id = i.id AND w.run_id = i.current_run_id
        LEFT JOIN outbox_events source ON source.id = w.run_id
        WHERE i.tenant_id = ? AND i.id = ?`,
      args: [input.tenantId, input.result.incidentId],
    });
    const row = scoped.rows[0];
    if (!row || typeof row.current_run_id !== 'string') throw new DomainError('CONFLICT');
    const workflowRunId = row.current_run_id;
    const correlationId = row.correlation_id;
    if (
      (input.expectedWorkflowRunId && input.expectedWorkflowRunId !== workflowRunId) ||
      typeof correlationId !== 'string' ||
      (input.expectedCorrelationId && input.expectedCorrelationId !== correlationId) ||
      (row.triage_result_json !== null && (row.triage_result_json !== canonical || row.triage_result_hash !== digest))
    )
      throw new DomainError('CONFLICT');

    const expectedIncidentStatus =
      input.result.status === 'blocked' ? 'failed' : input.result.status === 'benign' ? 'closed' : 'investigating';
    if (row.workflow_status === 'completed') {
      if (
        row.finished_at === null ||
        row.triage_result_json !== canonical ||
        row.triage_result_hash !== digest ||
        row.incident_status !== expectedIncidentStatus
      )
        throw new DomainError('CONFLICT');
      return;
    }
    if (row.workflow_status !== 'running' || row.incident_status !== 'investigating') throw new DomainError('CONFLICT');

    const now = clock.now();
    if (String(row.incident_updated_at) > now) throw new DomainError('CONFLICT');
    if (row.triage_result_json === null) {
      const triage = await tx.execute({
        sql: `UPDATE workflow_runs SET triage_result_json = ?, triage_result_hash = ?
          WHERE tenant_id = ? AND incident_id = ? AND run_id = ?
            AND triage_result_json IS NULL AND triage_result_hash IS NULL`,
        args: [canonical, digest, input.tenantId, input.result.incidentId, workflowRunId],
      });
      if (triage.rowsAffected !== 1) throw new DomainError('CONFLICT');
    }

    const incident = await tx.execute({
      sql: `UPDATE incidents SET status = ?, version = version + 1,
          timeline_sequence = timeline_sequence + 1, updated_at = ?
        WHERE tenant_id = ? AND id = ? AND status = 'investigating'
          AND version = ? AND current_run_id = ? AND updated_at <= ?
        RETURNING timeline_sequence`,
      args: [
        expectedIncidentStatus,
        now,
        input.tenantId,
        input.result.incidentId,
        Number(row.incident_version),
        workflowRunId,
        now,
      ],
    });
    const sequence = Number(incident.rows[0]?.timeline_sequence);
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new DomainError('CONFLICT');

    await insertTimelineAndOutbox(tx, {
      timelineId: ids.next(),
      eventId: ids.next(),
      incidentId: input.result.incidentId,
      tenantId: input.tenantId,
      sequence,
      type:
        input.result.status === 'blocked'
          ? 'incident.status_changed'
          : input.result.status === 'benign'
            ? 'incident.status_changed'
            : 'triage.completed',
      eventType:
        input.result.status === 'blocked' || input.result.status === 'benign'
          ? 'security.incident.updated'
          : 'security.workflow.updated',
      runId: workflowRunId,
      correlationId,
      causationId: workflowRunId,
      occurredAt: now,
      payload:
        input.result.status === 'blocked'
          ? {
              from: 'investigating',
              to: 'failed',
              triageStatus: input.result.status,
              reasonCodes: input.result.reasonCodes.join(','),
            }
          : input.result.status === 'benign'
            ? {
                from: 'investigating',
                to: 'closed',
                triageStatus: input.result.status,
                resolution: 'benign',
                reasonCodes: input.result.reasonCodes.join(','),
              }
            : {
                status: input.result.status,
                reasonCodes: input.result.reasonCodes.join(','),
              },
    });

    const completed = await tx.execute({
      sql: `UPDATE workflow_runs SET status = 'completed', finished_at = ?
        WHERE tenant_id = ? AND incident_id = ? AND run_id = ?
          AND status = 'running'`,
      args: [now, input.tenantId, input.result.incidentId, workflowRunId],
    });
    if (completed.rowsAffected !== 1) throw new DomainError('CONFLICT');
  });
}
