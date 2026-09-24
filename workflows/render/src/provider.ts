import { ClientError } from '@renderinc/sdk';
import { setTimeout as delay } from 'node:timers/promises';
import type { AnyWorkflow } from '@mastra/core/workflows';
import { RenderProtocolError, RenderRunConflictError, RenderSubmissionUnknownError, errorRecord } from './errors.js';
import { compileManifest, type Manifest } from './manifest.js';
import { DEFAULT_RETRY, NO_RETRY, taskPolicy, type TaskPolicy } from './policy.js';
import { frameworkJson, json, type RootEnvelope } from './protocol.js';
import { terminal, updateRun, type RenderPersistence, type RunRecord } from './persistence/types.js';
import { createRenderTransport, type RenderTransport } from './transport.js';

export interface RenderOptions {
  workflowSlug: string;
  /** Immutable application build identity. Use the same value in caller and worker. */
  buildId: string;
  persistence: RenderPersistence;
  rootTask?: Omit<TaskPolicy, 'retry'>;
  stepDefaults?: TaskPolicy;
  requestContextKeys?: readonly string[];
  pollIntervalMs?: number;
  /** Per-root concurrency bound, in addition to foreach concurrency. */
  maxConcurrentSteps?: number;
  /** Optional SDK client configuration, including local development URL. */
  client?: Parameters<typeof createRenderTransport>[0];
  /** Test or custom transport. Production normally uses the supplied SDK transport. */
  transport?: RenderTransport;
}

export interface WorkflowBinding {
  workflow: AnyWorkflow;
  provider: RenderProvider;
  rootPolicy: TaskPolicy;
  manifest(): Manifest;
}
export const workflowBindings = new WeakMap<AnyWorkflow, WorkflowBinding>();

export class RenderProvider {
  readonly store: RenderPersistence;
  readonly transport: RenderTransport;
  readonly contextKeys: readonly string[];
  readonly workflows = new Map<string, WorkflowBinding>();
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
    this.transport = options.transport ?? createRenderTransport(options.client);
    this.contextKeys = [...(options.requestContextKeys ?? [])];
  }

  register(workflow: AnyWorkflow, root?: Omit<TaskPolicy, 'retry'>): WorkflowBinding {
    if (this.workflows.has(workflow.id)) throw new RenderProtocolError(`Duplicate workflow id ${workflow.id}`);
    const binding: WorkflowBinding = {
      workflow,
      provider: this,
      rootPolicy: { ...taskPolicy(root, this.options.rootTask), retry: NO_RETRY },
      manifest: () =>
        compileManifest(
          workflow,
          this.options.buildId,
          { retry: DEFAULT_RETRY, ...this.options.stepDefaults },
          binding.rootPolicy,
        ),
    };
    this.workflows.set(workflow.id, binding);
    workflowBindings.set(workflow, binding);
    return binding;
  }

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
      createdAt: now,
      updatedAt: now,
    };
    if (!(await this.store.create(record))) {
      throw new RenderRunConflictError(`Run ${envelope.runId} already exists. Retrieve it instead of resubmitting.`);
    }
    let providerId: string;
    try {
      providerId = await this.transport.start(`${this.options.workflowSlug}/${binding.manifest().rootName}`, envelope);
    } catch (error) {
      const rejected =
        error instanceof ClientError && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 408;
      await updateRun(this.store, record.workflowId, record.runId, () => ({
        status: rejected ? 'failed' : 'submission-unknown',
        error: errorRecord(error),
      }));
      if (rejected) throw error;
      throw new RenderSubmissionUnknownError(record.runId, { cause: error });
    }
    try {
      // The root may already be running or complete. Binding must never regress that state.
      return await updateRun(this.store, record.workflowId, record.runId, current => ({
        providerId,
        status: current.status === 'submitting' ? 'pending' : current.status,
      }));
    } catch (error) {
      throw new RenderSubmissionUnknownError(record.runId, { cause: error });
    }
  }

  async getRun(workflowId: string, runId: string): Promise<RunRecord | null> {
    const record = await this.store.get(workflowId, runId);
    if (!record || terminal(record.status) || !record.providerId) return record;
    const remote = await this.transport.get(record.providerId);
    if (remote.status === 'pending' || remote.status === 'running') {
      return updateRun(this.store, workflowId, runId, current => ({
        status: current.status === 'cancel-requested' ? current.status : (remote.status as 'pending' | 'running'),
      }));
    }
    if (remote.status === 'completed' || remote.status === 'succeeded') {
      const result = remote.results?.[0];
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

  async cancel(workflowId: string, runId: string): Promise<void> {
    const record = await this.getRun(workflowId, runId);
    if (!record) throw new RenderRunConflictError(`Unknown run ${runId}`);
    if (terminal(record.status)) return;
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
