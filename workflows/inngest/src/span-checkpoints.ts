import type { Mastra } from '@mastra/core/mastra';
import type {
  AnySpan,
  EndSpanOptions,
  ErrorSpanOptions,
  ObservabilityInstance,
  SpanSnapshot,
  SpanType,
} from '@mastra/core/observability';
import { createEmptyWorkflowSnapshot } from '@mastra/core/storage';
import type { WorkflowSpanSnapshot } from '@mastra/core/workflows';

export type SpanCheckpointScope = { workflowId: string; runId: string; observabilityInstanceName?: string };
export type SpanCompletion = { end?: EndSpanOptions<SpanType>; error?: ErrorSpanOptions<SpanType> };
const checkpointKey = (span: SpanSnapshot<SpanType>) => `${span.traceId}:${span.id}`;
const canceled = { outcome: 'abort' as const, stopReason: 'caller_cancelled' as const, stopReasonContext: null };

export function checkpointObservability(mastra: Mastra | undefined, scope?: SpanCheckpointScope) {
  return scope?.observabilityInstanceName
    ? mastra?.observability?.getInstance(scope.observabilityInstanceName)
    : mastra?.observability?.getSelectedInstance({});
}

function registeredInstanceName(mastra: Mastra | undefined, instance: ObservabilityInstance): string {
  // A registry alias need not match getConfig().name. Persist a key that the
  // next worker can actually resolve through the observability entrypoint.
  for (const [name, registered] of mastra?.observability?.listInstances() ?? []) {
    if (registered === instance) return name;
  }
  return instance.getConfig().name;
}

/** Status and checkpoint updates share the store's transaction. A canceled run cannot commit a late success. */
async function persistCheckpoint(
  mastra: Mastra | undefined,
  scope: SpanCheckpointScope,
  instance: ObservabilityInstance,
  proposed: SpanSnapshot<SpanType>,
  operationId: string,
): Promise<WorkflowSpanSnapshot | undefined> {
  const store = await mastra?.getStorage()?.getStore('workflows');
  if (!store?.supportsWorkflowSpanSnapshots?.() || !instance.prepareSpanCompletion || !instance.emitSpanCompletion)
    return;
  const key = { workflowName: scope.workflowId, runId: scope.runId };
  const spanKey = checkpointKey(proposed);
  for (let attempt = 0; attempt < 5; attempt++) {
    const state = await store.loadWorkflowSnapshot(key);
    if (!state) return;
    const existing = state.tracingSpans?.[spanKey];
    if (existing?.endTime) return existing;
    let snapshot = proposed;
    if (state.status === 'canceled' && (!snapshot.endTime || snapshot.outcome !== 'abort')) {
      snapshot = instance.prepareSpanCompletion({ ...snapshot, endTime: undefined }, { end: canceled }) ?? snapshot;
    }
    const checkpoint: WorkflowSpanSnapshot = {
      ...snapshot,
      ...(existing?.nestedWorkflow ? { nestedWorkflow: existing.nestedWorkflow } : {}),
      observabilityInstanceName: registeredInstanceName(mastra, instance),
      ...(snapshot.endTime ? { completionOperationId: operationId } : {}),
    };
    const updated = await store.updateWorkflowState({
      ...key,
      opts: { status: state.status, expectedStatus: state.status, tracingSpans: { [spanKey]: checkpoint } },
    });
    if (updated) return updated.tracingSpans?.[spanKey];
  }
  throw new Error('Workflow status changed repeatedly while persisting its span checkpoint');
}

function adoptCompletion(span: AnySpan, snapshot: WorkflowSpanSnapshot) {
  Object.assign(span, {
    endTime: snapshot.endTime ? new Date(snapshot.endTime) : undefined,
    outcome: snapshot.outcome,
    stopReason: snapshot.stopReason,
    stopReasonContext: snapshot.stopReasonContext,
    output: snapshot.output,
    errorInfo: snapshot.errorInfo,
    attributes: snapshot.attributes,
  });
}

export async function checkpointStartedSpan(
  mastra: Mastra | undefined,
  scope: SpanCheckpointScope,
  instance: ObservabilityInstance,
  span: AnySpan,
) {
  const snapshot = span.snapshot();
  if (!snapshot) return;
  const operationId = `start:${checkpointKey(snapshot)}`;
  const saved = await persistCheckpoint(mastra, scope, instance, snapshot, operationId);
  if (saved?.endTime) {
    adoptCompletion(span, saved);
    if (saved.completionOperationId === operationId) {
      instance.emitSpanCompletion?.(saved);
      await instance.flush();
    }
  }
  return { ...(saved ?? snapshot), observabilityInstanceName: registeredInstanceName(mastra, instance) };
}

/** Called within an Inngest durable operation; retries export the same persisted completion. */
export async function completeCheckpointedSpan(
  mastra: Mastra | undefined,
  scope: SpanCheckpointScope | undefined,
  instance: ObservabilityInstance | undefined,
  span: AnySpan,
  operationId: string,
  completion: SpanCompletion,
) {
  const original = span.snapshot();
  const prepared =
    scope && original && instance?.emitSpanCompletion
      ? instance.prepareSpanCompletion?.(original, completion)
      : undefined;
  const saved =
    prepared && scope && instance ? await persistCheckpoint(mastra, scope, instance, prepared, operationId) : undefined;
  if (!saved?.endTime) {
    if (completion.error) span.error(completion.error);
    else span.end(completion.end);
    return;
  }
  adoptCompletion(span, saved);
  if (saved.completionOperationId === operationId) {
    instance!.emitSpanCompletion!(saved);
    await instance!.flush();
  }
}

/** Register before invoking so cancellation can recover the child without an in-memory run registry. */
export async function checkpointNestedWorkflow(
  mastra: Mastra | undefined,
  scope: SpanCheckpointScope,
  span: AnySpan | undefined,
  child: { workflowId: string; runId: string },
): Promise<boolean> {
  const store = await mastra?.getStorage()?.getStore('workflows');
  const snapshot = span?.snapshot();
  if (!store?.supportsWorkflowSpanSnapshots?.() || !store.supportsGuardedSnapshotWrites?.() || !snapshot) return true;
  const parentKey = { workflowName: scope.workflowId, runId: scope.runId };
  const childKey = { workflowName: child.workflowId, runId: child.runId };
  const key = checkpointKey(snapshot);
  for (let attempt = 0; attempt < 5; attempt++) {
    const parent = await store.loadWorkflowSnapshot(parentKey);
    const checkpoint = parent?.tracingSpans?.[key];
    if (!parent || !checkpoint) return true;
    if (parent.status === 'canceled') {
      await store.updateWorkflowState({
        ...childKey,
        opts: {
          status: 'canceled',
          expectedStatus: ['pending'],
        },
      });
      return false;
    }
    // Create the addressed row before publishing the relationship. A cancellation
    // arriving before invocation can then leave a tombstone the child will honor.
    await store.persistWorkflowSnapshot({
      ...childKey,
      snapshot: createEmptyWorkflowSnapshot(child.runId),
      expectedStatus: [],
    });
    const updated = await store.updateWorkflowState({
      ...parentKey,
      opts: {
        status: parent.status,
        expectedStatus: parent.status,
        tracingSpans: { [key]: { ...checkpoint, nestedWorkflow: child } },
      },
    });
    if (updated) return true;
  }
  throw new Error('Workflow status changed repeatedly while registering its child invocation');
}
