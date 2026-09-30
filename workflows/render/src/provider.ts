import { ClientError } from '@renderinc/sdk';
import { submissionHash } from './authorization.js';
import { setTimeout as delay } from 'node:timers/promises';
import type { AnyWorkflow } from '@mastra/core/workflows';
import { RenderProtocolError, RenderRunConflictError, RenderSubmissionUnknownError, errorRecord } from './errors.js';
import { compileManifest, type Manifest } from './manifest.js';
import { workflowBindings, type WorkflowBinding } from './bindings.js';
import { identity } from './native.js';
export { workflowBindings, type WorkflowBinding } from './bindings.js';
import { DEFAULT_RETRY, NO_RETRY, taskPolicy, type TaskPolicy } from './policy.js';
import { frameworkJson, json, type RootEnvelope } from './protocol.js';
import { terminal, updateRun, type RenderPersistence, type RunRecord } from './persistence/types.js';
import { createRenderTransport, type RenderTransport } from './transport.js';

export interface RenderOptions {
  workflowSlug: string;
  /** Immutable application build identity. Use the same value in caller and worker. */
  buildId: string;
  persistence: RenderPersistence;
  /** Root retries restart the entire graph. Zero by default; effects must be idempotent. */
  rootTask?: TaskPolicy;
  stepDefaults?: TaskPolicy;
  requestContextKeys?: readonly string[];
  pollIntervalMs?: number;
  /** Per-coordinator dispatch bound; each nested coordinator has its own limiter. */
  maxConcurrentSteps?: number;
  /** Optional SDK client configuration, including local development URL. */
  client?: Parameters<typeof createRenderTransport>[0];
  /** Test or custom transport. Production normally uses the supplied SDK transport. */
  transport?: RenderTransport;
}

export class RenderProvider {
  readonly store: RenderPersistence;
  readonly transport: RenderTransport;
  readonly contextKeys: readonly string[];
  readonly workflows = new Map<string, WorkflowBinding>();
  readonly localDevelopment: boolean;
  /** Validate provider configuration and initialize durable persistence and native transport. */
  constructor(readonly options: RenderOptions) {
    if (!options.workflowSlug || !options.buildId)
      throw new RenderProtocolError('workflowSlug and buildId are required');
    if (options.pollIntervalMs !== undefined && options.pollIntervalMs < 10)
      throw new RenderProtocolError('pollIntervalMs must be at least 10');
    if (
      options.maxConcurrentSteps !== undefined &&
      (!Number.isInteger(options.maxConcurrentSteps) || options.maxConcurrentSteps < 1)
    )
      throw new RenderProtocolError('maxConcurrentSteps must be a positive integer');
    this.store = options.persistence;
    // Match the SDK's explicit local-development configuration. Missing native IDs
    // are tolerated only in this mode, and never for coordinator retries.
    this.localDevelopment =
      options.client?.useLocalDev ??
      (!!options.client?.localDevUrl ||
        !!process.env.RENDER_LOCAL_DEV_URL ||
        ['1', 't', 'T', 'true', 'TRUE', 'True'].includes(process.env.RENDER_USE_LOCAL_DEV ?? ''));
    this.transport = options.transport ?? createRenderTransport(options.client);
    this.contextKeys = [...(options.requestContextKeys ?? [])];
  }

  /** Register a unique workflow and lazily cache its first successful committed manifest. */
  register(workflow: AnyWorkflow, root?: TaskPolicy): WorkflowBinding {
    if (this.workflows.has(workflow.id)) throw new RenderProtocolError(`Duplicate workflow id ${workflow.id}`);
    let manifest: Manifest | undefined;
    const binding: WorkflowBinding = {
      workflow,
      provider: this,
      rootPolicy: taskPolicy(root, { retry: NO_RETRY, ...this.options.rootTask }),
      manifest: ancestors =>
        (manifest ??= compileManifest(
          workflow,
          this.options.buildId,
          { retry: DEFAULT_RETRY, ...this.options.stepDefaults },
          binding.rootPolicy,
          ancestors,
        )),
    };
    this.workflows.set(workflow.id, binding);
    workflowBindings.set(workflow, binding);
    return binding;
  }

  /** Reserve a one-shot run ID and persist Render acceptance; retain ambiguous submissions without retrying. */
  async submit(binding: WorkflowBinding, envelope: RootEnvelope): Promise<RunRecord> {
    json([envelope], 'task arguments');
    const now = Date.now();
    const record: RunRecord = {
      workflowId: envelope.workflowId,
      runId: envelope.runId,
      ...(envelope.resourceId === undefined ? {} : { resourceId: envelope.resourceId }),
      buildId: envelope.buildId,
      manifest: envelope.manifest,
      revision: 0,
      status: 'submitting',
      input: json(envelope.input),
      initialState: json(envelope.state),
      submissionHash: submissionHash(envelope),
      idempotencyKey: identity(this.options.workflowSlug, envelope.workflowId, envelope.runId, envelope.manifest),
      createdAt: now,
      updatedAt: now,
    };
    if (!(await this.store.create(record))) {
      throw new RenderRunConflictError(`Run ${envelope.runId} already exists. Retrieve it instead of resubmitting.`);
    }
    let providerId: string;
    try {
      providerId = await this.transport.start(`${this.options.workflowSlug}/${binding.manifest().rootName}`, envelope, {
        idempotencyKey: record.idempotencyKey!,
      });
    } catch (error) {
      const rejected =
        error instanceof ClientError && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 408;
      await updateRun(this.store, record.workflowId, record.runId, current => ({
        // A worker claim proves acceptance; a lost response must not revoke its dispatch authority.
        status:
          current.workerClaim || current.status !== 'submitting'
            ? current.status
            : rejected
              ? 'failed'
              : 'submission-unknown',
        error: current.error ?? errorRecord(error),
      })).catch(() =>
        console.error('[mastra-render] Failed to persist the submission outcome; do not resubmit this run.'),
      );
      if (rejected) throw error;
      throw new RenderSubmissionUnknownError(record.runId, { cause: error });
    }
    try {
      // The root may have completed without a binding. Attach the accepted ID even to a
      // terminal record, preserving its outcome and closed dispatch authority.
      for (let attempt = 0; attempt < 12; attempt++) {
        const current = await this.store.get(record.workflowId, record.runId);
        if (!current) throw new RenderRunConflictError(`Unknown run ${record.runId}`);
        if (current.providerId && current.providerId !== providerId)
          throw new RenderRunConflictError(`Run ${record.runId} already has another provider binding`);
        const bound: RunRecord = {
          ...current,
          providerId,
          status: current.status === 'submitting' ? 'pending' : current.status,
          revision: current.revision + 1,
          updatedAt: Date.now(),
        };
        if (await this.store.compareAndSwap(bound, current.revision)) return bound;
      }
      throw new RenderRunConflictError(`Concurrent binding updates did not settle for ${record.runId}`);
    } catch (error) {
      await updateRun(this.store, record.workflowId, record.runId, current => ({
        status: current.workerClaim || current.status !== 'submitting' ? current.status : 'submission-unknown',
        error: current.error ?? errorRecord(error),
      })).catch(() =>
        console.error('[mastra-render] Failed to persist submission uncertainty; do not resubmit this run.'),
      );
      throw new RenderSubmissionUnknownError(record.runId, { cause: error });
    }
  }

  /** Reconcile one persisted run with native terminal state without regressing an active coordinator. */
  async getRun(workflowId: string, runId: string): Promise<RunRecord | null> {
    const record = await this.store.get(workflowId, runId);
    if (!record || terminal(record.status) || !record.providerId) return record;
    const remote = await this.transport.get(record.providerId);
    if (remote.status === 'pending' || remote.status === 'running' || remote.status === 'paused') {
      // Render pauses a coordinating root while its children run. This is still
      // an active Mastra execution, not user-directed suspend/resume.
      const status = remote.status === 'pending' ? 'pending' : 'running';
      return updateRun(this.store, workflowId, runId, current => ({
        // A stale pending read must not revoke a coordinator that already claimed the run.
        status:
          current.status === 'cancel-requested'
            ? current.status
            : current.workerClaim && !current.dispatchClosed
              ? 'running'
              : status,
      }));
    }
    if (remote.status === 'completed' || remote.status === 'succeeded') {
      const output = remote.results?.[0];
      const result =
        record.parent && output && typeof output === 'object' && 'result' in output ? output.result : output;
      if (!result || typeof result !== 'object' || !('status' in result) || result.status !== 'success') {
        throw new RenderProtocolError(`Render root ${record.providerId} completed without a successful Mastra result`);
      }
      return updateRun(this.store, workflowId, runId, () => ({ status: 'success', result: frameworkJson(result) }));
    }
    if (remote.status === 'failed' || remote.status === 'canceled') {
      return updateRun(this.store, workflowId, runId, current => ({
        status: remote.status as 'failed' | 'canceled',
        error: current.error ?? {
          name: remote.status === 'canceled' ? 'AbortError' : 'RenderTaskFailure',
          message: `Render task ${record.providerId} ${remote.status}`,
        },
      }));
    }
    throw new RenderProtocolError(`Unsupported Render task status ${remote.status}`);
  }

  /** Wait for terminal state using completion events and bounded polling; abort stops only this waiter. */
  async wait(workflowId: string, runId: string, signal?: AbortSignal): Promise<RunRecord> {
    let useEvents = !!this.transport.waitForEvent;
    while (true) {
      signal?.throwIfAborted();
      const record = await this.getRun(workflowId, runId);
      if (!record) throw new RenderRunConflictError(`Unknown run ${runId}`);
      if (record.status === 'submission-unknown') throw new RenderSubmissionUnknownError(runId);
      if (terminal(record.status)) return record;
      if (useEvents && record.providerId) {
        // Events wake this waiter, but never override authoritative lookup or initiate another run.
        // Fall back to polling after a disconnected or quiet stream. This bounds reconnect races.
        useEvents = false;
        const timeout = AbortSignal.timeout(30000);
        try {
          await this.transport.waitForEvent!(record.providerId, signal ? AbortSignal.any([signal, timeout]) : timeout);
        } catch {
          signal?.throwIfAborted();
        }
        continue;
      }
      await delay(this.options.pollIntervalMs ?? 500, undefined, { signal });
    }
  }

  /** Persist cancellation intent before the native call and preserve any terminal result won by a race. */
  async cancel(workflowId: string, runId: string): Promise<void> {
    const record = await this.getRun(workflowId, runId);
    if (!record) throw new RenderRunConflictError(`Unknown run ${runId}`);
    if (terminal(record.status)) return;
    if (record.parent)
      throw new RenderProtocolError('Cancel the top-level workflow; Render does not support child-only cancellation');
    if (!record.providerId) throw new RenderSubmissionUnknownError(runId);
    await updateRun(this.store, workflowId, runId, () => ({ status: 'cancel-requested' }));
    try {
      await this.transport.cancel(record.providerId);
    } catch (error) {
      // A completed task cannot be canceled. Reconcile before deciding whether this is an error.
      const latest = await this.getRun(workflowId, runId);
      if (latest && terminal(latest.status)) return;
      throw error;
    }
    await this.getRun(workflowId, runId);
  }
}
