import type { Mastra } from '../../mastra';
import { SpanType } from '../../observability';
import type { AnySpan, EndSpanOptions, ErrorSpanOptions, SpanTermination } from '../../observability';
import type { WorkflowRunState, WorkflowSpanSnapshot } from '../types';

/** Save a span before dispatch/waiting, optionally registering a new public execution root. */
export async function checkpointEventedSpan(
  mastra: Mastra | undefined,
  workflowId: string,
  runId: string,
  span: AnySpan | undefined,
  started = false,
  executionSpan?: WorkflowRunState['executionSpan'],
  nestedWorkflow?: WorkflowSpanSnapshot['nestedWorkflow'],
): Promise<void> {
  const snapshot = span?.snapshot();
  const store = await mastra?.getStorage()?.getStore('workflows');
  if (!span || !snapshot || !store?.supportsWorkflowSpanSnapshots?.()) return;
  const instance = span.observabilityInstance;
  const registered = [...(mastra?.observability?.listInstances() ?? [])].find(
    ([, candidate]) => candidate === instance,
  );
  const checkpoint = {
    ...snapshot,
    ...(executionSpan ? { executionSpan } : {}),
    ...(nestedWorkflow ? { nestedWorkflow } : {}),
    observabilityInstanceName: registered?.[0] ?? instance.getConfig().name,
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await store.loadWorkflowSnapshot({ workflowName: workflowId, runId });
    if (!current) return;
    const written = await store.updateWorkflowState({
      workflowName: workflowId,
      runId,
      opts: {
        status: current.status,
        expectedStatus: current.status,
        tracingSpans: { [`${snapshot.traceId}:${snapshot.id}`]: checkpoint },
        // A late completion from the prior segment must not move the pointer
        // back after resume registered a new invocation.
        ...(started
          ? {
              executionSpan: { traceId: snapshot.traceId, spanId: snapshot.id },
              tracingContext: { traceId: snapshot.traceId, spanId: snapshot.id, parentSpanId: snapshot.parentSpanId },
            }
          : {}),
      },
    });
    if (written) return;
  }
  throw new Error('Workflow status changed repeatedly while recording its span');
}

const completedSpans = new WeakSet<AnySpan>();
const pendingCompletions = new WeakMap<AnySpan, Promise<void>>();

export async function completeEventedSpan(...args: Parameters<typeof persistSpanCompletion>): Promise<void> {
  const span = args[3];
  if (!span) return;
  const pending = pendingCompletions.get(span);
  if (pending) await pending;
  if (completedSpans.has(span)) return;
  const completion = persistSpanCompletion(...args);
  pendingCompletions.set(span, completion);
  try {
    await completion;
    completedSpans.add(span);
    if (args[0]) liveSpans.get(args[0])?.delete(liveKey(args[1], args[2], span));
  } finally {
    if (pendingCompletions.get(span) === completion) pendingCompletions.delete(span);
  }
}

/** Persist the winning completion before exporting it; a surviving worker can finish a caller's root. */
async function persistSpanCompletion(
  mastra: Mastra | undefined,
  workflowId: string,
  runId: string,
  span: AnySpan | undefined,
  operationId: string,
  completion: { end?: EndSpanOptions<SpanType>; error?: ErrorSpanOptions<SpanType> },
): Promise<void> {
  if (!span) return;
  const instance = span.observabilityInstance;
  const original = span.snapshot();
  const store = await mastra?.getStorage()?.getStore('workflows');
  const prepared = original && instance.emitSpanCompletion && instance.prepareSpanCompletion?.(original, completion);
  if (prepared && store?.supportsWorkflowSpanSnapshots?.()) {
    const key = `${prepared.traceId}:${prepared.id}`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await store.loadWorkflowSnapshot({ workflowName: workflowId, runId });
      if (!current) break;
      let saved = current.tracingSpans?.[key];
      if (!saved?.endTime) {
        const proposed =
          current.status === 'canceled' && prepared.outcome !== 'abort'
            ? instance.prepareSpanCompletion!(
                { ...prepared, endTime: undefined },
                {
                  end: { outcome: 'abort', stopReason: 'caller_cancelled', stopReasonContext: null },
                },
              )!
            : prepared;
        const registered = [...(mastra?.observability?.listInstances() ?? [])].find(
          ([, candidate]) => candidate === instance,
        );
        const updated = await store.updateWorkflowState({
          workflowName: workflowId,
          runId,
          opts: {
            status: current.status,
            expectedStatus: current.status,
            tracingSpans: {
              [key]: {
                ...proposed,
                ...(saved?.executionSpan ? { executionSpan: saved.executionSpan } : {}),
                ...(saved?.nestedWorkflow ? { nestedWorkflow: saved.nestedWorkflow } : {}),
                observabilityInstanceName: registered?.[0] ?? instance.getConfig().name,
                completionOperationId: operationId,
              },
            },
          },
        });
        if (!updated) continue;
        saved = updated.tracingSpans?.[key];
      }
      if (saved?.endTime) {
        Object.assign(span, {
          endTime: new Date(saved.endTime),
          outcome: saved.outcome,
          stopReason: saved.stopReason,
          stopReasonContext: saved.stopReasonContext,
          output: saved.output,
          errorInfo: saved.errorInfo,
          attributes: saved.attributes,
        });
        if (saved.completionOperationId === operationId) {
          instance.emitSpanCompletion!(saved);
          await instance.flush();
        }
        return;
      }
    }
    // Do not export a competing, uncommitted result after repeated status conflicts.
    if (await store.loadWorkflowSnapshot({ workflowName: workflowId, runId })) {
      throw new Error('Workflow status changed repeatedly while completing its root span');
    }
  }
  if (completion.error) span.error(completion.error);
  else span.end(completion.end);
}

type LiveCheckpoint = {
  workflowId: string;
  runId: string;
  span: AnySpan;
  executionSpan: NonNullable<WorkflowRunState['executionSpan']>;
  ready: Promise<void>;
};
const liveSpans = new WeakMap<Mastra, Map<string, LiveCheckpoint>>();
const liveKey = (workflowId: string, runId: string, span: { traceId: string; id: string }) =>
  JSON.stringify([workflowId, runId, span.traceId, span.id]);

/** Register synchronously so cancellation can await a child's start checkpoint before ending its tree. */
export function checkpointEventedChildSpan(
  mastra: Mastra | undefined,
  workflowId: string,
  runId: string,
  span: AnySpan | undefined,
  executionSpan: NonNullable<WorkflowRunState['executionSpan']>,
  nestedWorkflow?: WorkflowSpanSnapshot['nestedWorkflow'],
): Promise<void> {
  if (!mastra || !span?.snapshot()) return Promise.resolve();
  let entries = liveSpans.get(mastra);
  if (!entries) liveSpans.set(mastra, (entries = new Map()));
  const key = liveKey(workflowId, runId, span);
  const ready = checkpointEventedSpan(mastra, workflowId, runId, span, false, executionSpan, nestedWorkflow);
  entries.set(key, { workflowId, runId, span, executionSpan, ready });
  void ready.catch(() => entries.delete(key));
  return ready;
}

/** Complete persisted children before native tree traversal can independently end their live counterparts. */
export async function completeCheckpointedEventedChildren(
  mastra: Mastra | undefined,
  workflowId: string,
  runId: string,
  operationId: string,
  termination: SpanTermination,
  visited = new Set<string>(),
): Promise<void> {
  if (!mastra) return;
  const notifyChildren = visited.size === 0;
  const runKey = JSON.stringify([workflowId, runId]);
  if (visited.has(runKey)) return;
  visited.add(runKey);
  const completedTrees = new Set<AnySpan>();
  const live = liveSpans.get(mastra);
  const local = [...(live?.values() ?? [])].filter(entry => entry.workflowId === workflowId && entry.runId === runId);
  await Promise.all(local.map(entry => entry.ready));
  const store = await mastra.getStorage()?.getStore('workflows');
  const state = await store?.loadWorkflowSnapshot({ workflowName: workflowId, runId });
  const root = mastra.__getRunTracingContext(runId)?.currentSpan;
  const active = state?.executionSpan ?? (root ? { traceId: root.traceId, spanId: root.id } : undefined);
  const matches = (owner: WorkflowRunState['executionSpan']) =>
    !!owner && !!active && owner.traceId === active.traceId && owner.spanId === active.spanId;
  for (const checkpoint of Object.values(state?.tracingSpans ?? {})) {
    if (!matches(checkpoint.executionSpan)) continue;
    const child = checkpoint.nestedWorkflow;
    if (child && store) {
      const key = { workflowName: child.workflowId, runId: child.runId };
      await store.updateWorkflowState({
        ...key,
        opts: {
          status: 'canceled',
          expectedStatus: ['pending', 'running', 'suspended', 'waiting', 'paused', 'skipped', 'canceled'],
        },
      });
      const childState = await store.loadWorkflowSnapshot(key);
      if (childState?.status === 'canceled') {
        // Each cancellation handler notifies its direct children. The inline walk
        // only settles descendant checkpoints before tree traversal; publishing
        // from every ancestor would multiply messages with nesting depth.
        if (notifyChildren)
          await mastra.pubsub.publish('workflows', {
            type: 'workflow.cancel',
            runId: child.runId,
            data: child,
          });
        await completeCheckpointedEventedChildren(
          mastra,
          child.workflowId,
          child.runId,
          operationId,
          termination,
          visited,
        );
        const pointer = childState.executionSpan;
        const saved = pointer && childState.tracingSpans?.[`${pointer.traceId}:${pointer.spanId}`];
        if (saved) {
          const liveRoot = mastra.__getRunTracingContext(child.runId)?.currentSpan;
          const instance = saved.observabilityInstanceName
            ? mastra.observability?.getInstance(saved.observabilityInstanceName)
            : undefined;
          const childRoot =
            liveRoot?.id === saved.id && liveRoot.traceId === saved.traceId ? liveRoot : instance?.rebuildSpan(saved);
          await completeEventedSpan(
            mastra,
            child.workflowId,
            child.runId,
            childRoot,
            `${operationId}:nested:${saved.id}`,
            { end: termination },
          );
          if (childRoot) completedTrees.add(childRoot);
        }
      }
    }
    const original = live?.get(liveKey(workflowId, runId, checkpoint))?.span;
    if (checkpoint.endTime && !original) continue;
    const instance = checkpoint.observabilityInstanceName
      ? mastra.observability?.getInstance(checkpoint.observabilityInstanceName)
      : undefined;
    const span = original ?? instance?.rebuildSpan(checkpoint);
    if (!span) continue;
    await completeEventedSpan(
      mastra,
      workflowId,
      runId,
      span,
      `${operationId}:${checkpoint.traceId}:${checkpoint.id}`,
      {
        end: {
          ...termination,
          ...(span.type === SpanType.WORKFLOW_STEP ? { attributes: { status: 'canceled' } } : {}),
        },
      },
    );
    completedTrees.add(span);
  }
  // Adapters without checkpoints still coordinate their live spans before root.endTree().
  for (const entry of local) {
    if (!matches(entry.executionSpan)) continue;
    await completeEventedSpan(
      mastra,
      workflowId,
      runId,
      entry.span,
      `${operationId}:${entry.span.traceId}:${entry.span.id}`,
      {
        end: {
          ...termination,
          ...(entry.span.type === SpanType.WORKFLOW_STEP ? { attributes: { status: 'canceled' } } : {}),
        },
      },
    );
    completedTrees.add(entry.span);
  }
  // Persist every checkpoint before a parent traversal can end a live child independently.
  for (const span of completedTrees) span.endTree(termination);
}
