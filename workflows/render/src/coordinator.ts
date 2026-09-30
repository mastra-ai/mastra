import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { TaskContext, TaskDefinition } from '@renderinc/sdk/workflows';
import { RequestContext } from '@mastra/core/request-context';
import type { Mastra } from '@mastra/core/mastra';
import { getWorkflowFGAResourceId, MastraFGAPermissions, requireFGA } from '@mastra/core/auth/ee';
import {
  assertAncestors,
  assertDispatchOpen,
  authorizeDispatch,
  submissionHash,
  verifyNestedDispatch,
} from './authorization.js';
import { encodeRequestContext } from './context.js';
import { RenderProtocolError, errorRecord } from './errors.js';
import { identity, nativeIdentity } from './native.js';
import { terminal, updateRun, type RunRecord } from './persistence/types.js';
import { frameworkJson, type RootEnvelope } from './protocol.js';
import type { WorkflowBinding } from './bindings.js';
import { RenderRun } from './run.js';
import { createDispatchLimiter, withTaskRuntime } from './runtime-internal.js';

/** Run one native attempt. Render owns retry scheduling; each attempt starts a fresh Mastra graph. */
export async function executeCoordinator(
  binding: WorkflowBinding,
  context: TaskContext,
  envelope: RootEnvelope,
  tasks: ReadonlyMap<string, TaskDefinition<[unknown], unknown>>,
  mastra: Mastra,
) {
  const native = nativeIdentity(context, binding.provider.localDevelopment);
  if (!native && binding.rootPolicy.retry?.maxRetries)
    throw new RenderProtocolError(
      'Root retries require native task metadata. CLI 2.28.0 does not provide it; test root retries on hosted Render.',
    );
  const store = binding.provider.store;
  if (envelope.parent) {
    const parent = await store.get(envelope.parent.workflowId, envelope.parent.runId);
    verifyNestedDispatch(envelope, parent);
    if (native && (native.parentTaskRunId !== parent!.providerId || native.rootTaskRunId !== parent!.rootProviderId))
      throw new RenderProtocolError('Nested workflow native parent/root identity mismatch');
    const fgaProvider = mastra.getServer()?.fga;
    if (fgaProvider) {
      const requestContext = new RequestContext<unknown>(Object.entries(envelope.requestContext));
      await requireFGA({
        fgaProvider,
        user: requestContext.get('user'),
        resource: { type: 'workflow', id: getWorkflowFGAResourceId(binding.workflow.id) },
        permission: MastraFGAPermissions.WORKFLOWS_EXECUTE,
        requestContext,
        context: { resourceId: envelope.resourceId },
        metadata: { workflowId: envelope.workflowId, runId: envelope.runId, resourceId: envelope.resourceId },
      });
    }
  } else if (native && (native.parentTaskRunId || native.taskRunId !== native.rootTaskRunId)) {
    throw new RenderProtocolError('A top-level Mastra run requires a native Render root');
  }

  const workerClaim = randomBytes(32).toString('hex');
  const attempt = identity(workerClaim);
  const claimed = await updateRun(store, envelope.workflowId, envelope.runId, current => {
    if (
      current.manifest !== envelope.manifest ||
      current.resourceId !== envelope.resourceId ||
      current.buildId !== envelope.buildId ||
      current.submissionHash !== submissionHash(envelope) ||
      terminal(current.status) ||
      current.status === 'cancel-requested'
    )
      throw new RenderProtocolError('Missing, mismatched or terminal Mastra run binding');
    if (native && current.providerId && current.providerId !== native.taskRunId)
      throw new RenderProtocolError('Mastra run is already bound to another native task');
    if (current.workerClaim && !binding.rootPolicy.retry?.maxRetries)
      throw new RenderProtocolError('This Mastra run was already claimed by a root task');
    if (current.workerClaim && !current.providerId)
      throw new RenderProtocolError('Cannot retry an older run without native task identity');
    return {
      providerId: native?.taskRunId ?? current.providerId,
      rootProviderId: native?.rootTaskRunId ?? current.rootProviderId,
      workerClaim,
      attempt,
      // Separate physical snapshot IDs keep old attempts from corrupting current snapshots.
      snapshotRunId: current.workerClaim ? `${envelope.runId}-attempt-${attempt}` : envelope.runId,
      status: 'running',
      result: undefined,
      error: undefined,
      dispatchClosed: false,
      dispatchExpiresAt: Date.now() + (binding.rootPolicy.timeoutSeconds ?? 7200) * 1000,
    };
  });
  if (claimed.workerClaim !== workerClaim || terminal(claimed.status))
    throw new RenderProtocolError('Run became terminal before worker claim');

  const assertActive = async () => {
    const current = await store.get(envelope.workflowId, envelope.runId);
    if (!current || current.workerClaim !== workerClaim)
      throw new RenderProtocolError('Coordinator attempt was superseded');
    assertDispatchOpen(current);
    await assertAncestors(store, current);
  };
  // CAS checks ownership again, so a superseded handler cannot publish or close the new attempt.
  const write = (patch: Partial<RunRecord> | ((current: RunRecord) => Partial<RunRecord>)) =>
    updateRun(store, envelope.workflowId, envelope.runId, current =>
      current.workerClaim === workerClaim && current.status !== 'cancel-requested'
        ? typeof patch === 'function'
          ? patch(current)
          : patch
        : {},
    );
  try {
    await assertActive();
    return await withTaskRuntime(
      {
        context,
        tasks,
        run: envelope,
        localRunId: claimed.snapshotRunId,
        attempt,
        readOnly: envelope.readOnly ?? false,
        dispatch: createDispatchLimiter(binding.provider.options.maxConcurrentSteps ?? 16),
        assertActive,
        authorize: value => authorizeDispatch(value, workerClaim),
      },
      async () => {
        const requestContext = new RequestContext<unknown>(Object.entries(envelope.requestContext));
        const run = await binding.workflow.createRun({ runId: claimed.snapshotRunId, resourceId: envelope.resourceId });
        if (!(run instanceof RenderRun)) throw new RenderProtocolError('Worker workflow is not a Render workflow');
        const result = await run.executeLocal({
          inputData: envelope.input,
          initialState: envelope.state,
          requestContext,
          ...(envelope.parent ? { outputOptions: { includeState: true } } : {}),
        });
        await assertActive();
        const serialized = frameworkJson({ ...result, runId: envelope.runId });
        const saved = await write(current => ({
          result: serialized,
          dispatchClosed: true,
          ...(!native && !current.providerId
            ? { status: result.status === 'success' ? ('success' as const) : ('failed' as const) }
            : {}),
          ...(result.status === 'failed' ? { error: errorRecord(result.error) } : {}),
        }));
        if (
          saved.workerClaim !== workerClaim ||
          saved.status === 'cancel-requested' ||
          (terminal(saved.status) && saved.status !== result.status)
        )
          throw new RenderProtocolError('Coordinator lost ownership before completion');
        if (result.status === 'failed') {
          if (result.error instanceof Error) throw result.error;
          const failure = errorRecord(result.error);
          throw Object.assign(new Error(failure.message), { name: failure.name });
        }
        if (result.status !== 'success') throw new Error(`Mastra workflow ${envelope.workflowId} ${result.status}`);
        return envelope.parent
          ? {
              result: serialized,
              snapshotRunId: claimed.snapshotRunId,
              requestContext: encodeRequestContext(requestContext, binding.provider.contextKeys),
            }
          : serialized;
      },
    );
  } catch (error) {
    // Render cancels descendants before the root. Reporting an error while that
    // cancellation is propagating can incorrectly finalize the root as failed.
    // Stop application work and let Render terminate the handler. The existing
    // coordinator deadline bounds this wait if the cancellation request fails.
    let current = await store.get(envelope.workflowId, envelope.runId).catch(() => {
      console.error('[mastra-render] Failed to read cancellation state.');
      return null;
    });
    if (current?.workerClaim === workerClaim) {
      const deadline = Math.min(claimed.dispatchExpiresAt!, current.dispatchExpiresAt ?? Infinity);
      const visited = new Set<string>();
      while (current) {
        if (current.status === 'cancel-requested' || current.status === 'canceled') {
          const remaining = Math.max(0, deadline - Date.now());
          if (remaining) await delay(remaining);
          break;
        }
        const parent: RunRecord['parent'] = current.parent;
        if (!parent) break;
        const key = JSON.stringify([parent.workflowId, parent.runId]);
        if (visited.has(key)) break;
        visited.add(key);
        current = await store.get(parent.workflowId, parent.runId).catch(() => {
          console.error('[mastra-render] Failed to read ancestor cancellation state.');
          return null;
        });
        if (current?.attempt !== parent.attempt) break;
      }
    }
    // Keep the logical run nonterminal until Render exhausts native retries.
    await write(current => ({
      error: errorRecord(error),
      dispatchClosed: true,
      ...(!native && !current.providerId ? { status: 'failed' as const } : {}),
    })).catch(() => console.error('[mastra-render] Failed to persist coordinator error.'));
    throw error;
  } finally {
    await write({ dispatchClosed: true }).catch(() =>
      console.error('[mastra-render] Failed to close child dispatch; authority expires at its deadline.'),
    );
  }
}
