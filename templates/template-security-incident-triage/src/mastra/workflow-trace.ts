import type { OperationalStore } from '../db/operational-store.js';
import { WorkflowTraceCarrierSchema, startWorkflowBoundary, type WorkflowTraceCarrier } from './observability.js';

/** Reads only the immutable, source-bound workflow carrier. */
export async function readWorkflowTrace(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    incidentId: string;
    workflowRunId: string;
  }>,
): Promise<WorkflowTraceCarrier | undefined> {
  const result = await store.execute({
    sql: `SELECT trace_context_json FROM workflow_runs
      WHERE tenant_id = ? AND incident_id = ? AND run_id = ?`,
    args: [input.tenantId, input.incidentId, input.workflowRunId],
  });
  const raw = result.rows[0]?.trace_context_json;
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== 'string') return undefined;
  try {
    return WorkflowTraceCarrierSchema.safeParse(JSON.parse(raw)).data;
  } catch {
    // Telemetry never becomes a control-plane dependency. Invalid context is
    // rejected at the signed outbox boundary; invalid stored context simply
    // starts a fresh redacted span rather than blocking containment.
    return undefined;
  }
}

/**
 * Durably advances the parent capability after a boundary ends.  The compare
 * and swap is intentional: duplicate delivery may read an old carrier but it
 * must never turn a later span back into a sibling of workflow.start.
 */
export async function advanceWorkflowTrace(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    incidentId: string;
    workflowRunId: string;
    previous: WorkflowTraceCarrier;
    next: WorkflowTraceCarrier;
  }>,
): Promise<boolean> {
  const previous = WorkflowTraceCarrierSchema.parse(input.previous);
  const previousSerialized = JSON.stringify(previous);
  const next = JSON.stringify(WorkflowTraceCarrierSchema.parse(input.next));
  return store.transaction(async tx => {
    // A trace id alone is not a capability: every boundary receives a
    // serialized parent and an incrementing fence.  The second predicate
    // prevents two workers that share a trace id from restoring an obsolete
    // parent after a later boundary has committed.
    const current = await tx.execute({
      sql: `SELECT trace_context_version FROM workflow_runs
        WHERE tenant_id = ? AND incident_id = ? AND run_id = ?
          AND trace_context_json = ?`,
      args: [input.tenantId, input.incidentId, input.workflowRunId, previousSerialized],
    });
    const version = Number(current.rows[0]?.trace_context_version);
    if (!Number.isInteger(version)) return false;
    const updated = await tx.execute({
      sql: `UPDATE workflow_runs
        SET trace_context_json = ?, trace_context_version = trace_context_version + 1
        WHERE tenant_id = ? AND incident_id = ? AND run_id = ?
          AND trace_context_json = ? AND trace_context_version = ?`,
      args: [next, input.tenantId, input.incidentId, input.workflowRunId, previousSerialized, version],
    });
    return updated.rowsAffected === 1;
  });
}

/**
 * Emits an official, redacted workflow boundary and advances the durable
 * carrier only after its operation has finished.  This is deliberately a
 * small adapter over the existing Observability/MastraStorageExporter path:
 * it does not create a tracer, storage table, or parallel telemetry channel.
 *
 * Parallel gather branches retain the workflow-start parent (`advance: false`)
 * so siblings stay siblings. Every serial boundary uses compare-and-swap with
 * the complete carrier and fence above, making a stale retry observable but
 * unable to regress the continuation.
 */
export async function withinWorkflowBoundary<T>(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    incidentId: string;
    workflowRunId: string;
    correlationId: string;
    boundary: Parameters<typeof startWorkflowBoundary>[0]['boundary'];
    stepId?: string;
    toolCallId?: string;
    provider?: string;
    advance?: boolean;
  }>,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = await readWorkflowTrace(store, {
    tenantId: input.tenantId,
    incidentId: input.incidentId,
    workflowRunId: input.workflowRunId,
  });
  const trace = startWorkflowBoundary({
    boundary: input.boundary,
    tenantId: input.tenantId,
    incidentId: input.incidentId,
    runId: input.workflowRunId,
    correlationId: input.correlationId,
    requestId: previous?.requestId ?? input.workflowRunId,
    ...(previous ? { context: previous } : {}),
    identifiers: {
      ...(input.stepId ? { stepId: input.stepId } : {}),
      ...(input.toolCallId ? { toolCallId: input.toolCallId } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
    },
  });
  try {
    const result = await operation();
    trace.span.end({ attributes: { success: true } as never });
    if (previous && input.advance !== false)
      await advanceWorkflowTrace(store, {
        tenantId: input.tenantId,
        incidentId: input.incidentId,
        workflowRunId: input.workflowRunId,
        previous,
        next: {
          ...trace.context,
          runId: input.workflowRunId,
          requestId: previous.requestId,
        },
      });
    return result;
  } catch (error) {
    trace.span.error({ error: error as Error, endSpan: true });
    throw error;
  }
}
