import { RenderProtocolError, errorRecord } from './errors.js';
import { submissionHash } from './authorization.js';
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
  constructor(
    error: unknown,
    readonly snapshotRunId?: string,
  ) {
    super(errorRecord(error).message, { cause: error });
    this.name = 'NestedExecutionError';
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
    status: 'pending',
    input: json(envelope.input),
    initialState: json(envelope.state),
    parent: envelope.parent,
    submissionHash: submissionHash(envelope),
    createdAt: now,
    updatedAt: now,
  });
  if (!created) throw new RenderProtocolError('Nested workflow invocation was already reserved');
  try {
    const result = await dispatchChild(binding.manifest().rootName, envelope);
    return outcomeSchema.parse(frameworkJson(result));
  } catch (error) {
    const record = await binding.provider.store.get(envelope.workflowId, runId).catch(() => null);
    throw new NestedExecutionError(error, record?.snapshotRunId);
  }
}
