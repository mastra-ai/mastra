import { RenderProtocolError, errorRecord } from './errors.js';
import { assertAncestors, submissionHash } from './authorization.js';
import { updateRun, type RenderPersistence, type RunRecord } from './persistence/types.js';
import { identity } from './native.js';
import { frameworkJson, json, PROTOCOL_VERSION, type RootEnvelope } from './protocol.js';
import type { WorkflowBinding } from './bindings.js';
import { coordinatorRuntime, dispatchChild } from './runtime-internal.js';
import { z } from 'zod';

const outcomeSchema = z
  .object({
    result: z.object({ status: z.literal('success'), result: z.unknown(), state: z.unknown() }).passthrough(),
    requestContext: z.record(z.unknown()),
    snapshotRunId: z.string().min(1),
  })
  .strict();

export class NestedExecutionError extends Error {
  /** Preserve the original nested failure and any snapshot already produced by the child. */
  constructor(
    error: unknown,
    readonly snapshotRunId?: string,
  ) {
    super(errorRecord(error).message, { cause: error });
    this.name = 'NestedExecutionError';
  }
}

/** Record only unclaimed outcomes; acceptance, cancellation and terminal results won by races take precedence. */
async function settleUnbound(
  store: RenderPersistence,
  workflowId: string,
  runId: string,
  status: 'failed' | 'submission-unknown',
  error: unknown,
): Promise<RunRecord> {
  return updateRun(store, workflowId, runId, current =>
    current.providerId || current.workerClaim || current.status === 'cancel-requested'
      ? {}
      : {
          status,
          error: current.error ?? errorRecord(error),
          ...(status === 'failed' ? { dispatchClosed: true } : {}),
        },
  );
}

/** Recover abandoned reservations without guessing native acceptance or automatically dispatching them again. */
export async function reconcileUnboundNested(store: RenderPersistence, record: RunRecord): Promise<RunRecord> {
  if (!record.parent || record.providerId || record.workerClaim || record.status === 'submission-unknown')
    return record;
  try {
    await assertAncestors(store, record);
    return record;
  } catch (error) {
    // Storage outages must remain errors, not evidence about a task's execution.
    if (!(error instanceof RenderProtocolError)) throw error;
    return settleUnbound(store, record.workflowId, record.runId, 'submission-unknown', error);
  }
}

/** Reserve a child logical run, then chain its coordinator using Render's native task context. */
export async function executeNested(
  binding: WorkflowBinding,
  input: {
    input: unknown;
    state: unknown;
    requestContext: Record<string, unknown>;
    readOnly: boolean;
    executionKey: string;
    resourceId?: string;
  },
) {
  const active = coordinatorRuntime();
  await active.assertActive();
  const runId = identity(active.run.runId, active.attempt, binding.workflow.id, input.executionKey);
  const envelope: RootEnvelope = {
    version: PROTOCOL_VERSION,
    workflowId: binding.workflow.id,
    runId,
    ...(input.resourceId === undefined ? {} : { resourceId: input.resourceId }),
    buildId: binding.provider.options.buildId,
    manifest: binding.manifest().hash,
    input: json(input.input),
    state: json(input.state),
    requestContext: input.requestContext,
    parent: { workflowId: active.run.workflowId, runId: active.run.runId, attempt: active.attempt },
    readOnly: input.readOnly,
  };
  json([envelope], 'nested workflow arguments');
  const now = Date.now();
  const created = await binding.provider.store.create({
    workflowId: envelope.workflowId,
    runId,
    resourceId: envelope.resourceId,
    buildId: envelope.buildId,
    manifest: envelope.manifest,
    revision: 0,
    status: 'submitting',
    input: json(envelope.input),
    initialState: json(envelope.state),
    parent: envelope.parent,
    submissionHash: submissionHash(envelope),
    createdAt: now,
    updatedAt: now,
  });
  if (!created) throw new RenderProtocolError('Nested workflow invocation was already reserved');
  let dispatched = false;
  try {
    const result = await dispatchChild(binding.manifest().rootName, envelope, () => {
      dispatched = true;
    });
    return outcomeSchema.parse(frameworkJson(result));
  } catch (error) {
    const record = await settleUnbound(
      binding.provider.store,
      envelope.workflowId,
      runId,
      dispatched ? 'submission-unknown' : 'failed',
      error,
    ).catch(() => {
      console.error('[mastra-render] Failed to persist nested submission outcome; inspect this run before recovery.');
      return null;
    });
    throw new NestedExecutionError(error, record?.snapshotRunId);
  }
}
