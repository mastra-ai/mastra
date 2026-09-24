import { Workflow } from '@mastra/core/workflows';
import type { DefaultEngineType, Step, WorkflowConfig, WorkflowState, Run } from '@mastra/core/workflows';
import { RenderExecutionEngine } from './execution-engine.js';
import { unsupported } from './errors.js';
import { RenderRun } from './run.js';
import { type RenderProvider, type WorkflowBinding } from './provider.js';
import type { TaskPolicy } from './policy.js';
import { isActiveWorkerRun } from './runtime-internal.js';

export class RenderWorkflow<
  TId extends string,
  TState,
  TInput,
  TOutput,
  TSteps extends Step[] = Step[],
  TContext = unknown,
> extends Workflow<DefaultEngineType, TSteps, TId, TState, TInput, TOutput, TInput, TContext> {
  readonly binding: WorkflowBinding;
  constructor(
    config: WorkflowConfig<TId, TState, TInput, TOutput, TSteps, TContext>,
    provider: RenderProvider,
    root?: Omit<TaskPolicy, 'retry'>,
  ) {
    if (config.executionEngine || config.retryConfig?.attempts || config.schedule)
      unsupported('custom engines, framework retries or schedules');
    let binding: WorkflowBinding;
    const options = {
      ...config.options,
      autoRestartActiveRuns: false,
      validateInputs: true,
      shouldPersistSnapshot: config.options?.shouldPersistSnapshot ?? (() => true),
    };
    const engine = new RenderExecutionEngine(
      {
        buildId: provider.options.buildId,
        allowedContext: provider.contextKeys,
        manifest: () => binding.manifest(),
      },
      { options },
    );
    super({ ...config, executionEngine: engine, retryConfig: { attempts: 0, delay: 0 }, options });
    this.engineType = 'render';
    this.binding = binding = provider.register(this, root);
  }

  override async createRun(
    options?: Parameters<Workflow['createRun']>[0],
  ): Promise<Run<DefaultEngineType, TSteps, TState, TInput, TOutput, TContext>> {
    this.binding.manifest();
    const base = await super.createRun(options);
    if (base.constructor === RenderRun) return base;
    const run = new RenderRun<TSteps, TState, TInput, TOutput, TContext>(
      {
        workflowId: this.id,
        runId: base.runId,
        resourceId: base.resourceId,
        stateSchema: this.stateSchema,
        inputSchema: this.inputSchema,
        requestContextSchema: this.requestContextSchema,
        executionEngine: base.executionEngine,
        executionGraph: base.executionGraph,
        serializedStepGraph: this.serializedStepGraph,
        workflowSteps: this.steps,
        workflowEngineType: 'render',
        mastra: this.mastra,
        retryConfig: { attempts: 0, delay: 0 },
        validateInputs: true,
        pubsub: options?.pubsub,
        disableScorers: options?.disableScorers,
        cleanup: () => {
          this.runs.delete(base.runId);
          this.executionEngine.clearRunPersistenceOverride(base.runId);
        },
      },
      this.binding,
    );
    this.runs.set(base.runId, run);
    return run;
  }

  override async getWorkflowRunById(
    runId: string,
    options?: Parameters<Workflow['getWorkflowRunById']>[1],
  ): Promise<WorkflowState | null> {
    const snapshot = await super.getWorkflowRunById(runId, options);
    // Core createRun calls this method while hydrating the worker's own run.
    // That handler already owns the root claim; native child dispatch needs no API key.
    const record = isActiveWorkerRun(this.id, runId)
      ? await this.binding.provider.store.get(this.id, runId)
      : await this.binding.provider.getRun(this.id, runId);
    if (!record) return snapshot;
    const status =
      record.status === 'submitting' || record.status === 'submission-unknown'
        ? 'pending'
        : record.status === 'cancel-requested'
          ? 'running'
          : record.status;
    const result =
      record.result && typeof record.result === 'object' && !Array.isArray(record.result) ? record.result : undefined;
    return {
      ...snapshot,
      runId,
      workflowName: this.id,
      resourceId: record.resourceId,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      status,
      ...(result?.result === undefined ? {} : { result: result.result as WorkflowState['result'] }),
      ...(record.error ? { error: record.error } : {}),
    };
  }
  override restartAllActiveWorkflowRuns(): never {
    return unsupported('automatic restart of Render workflows');
  }
  override listWorkflowRuns(): never {
    return unsupported('provider-wide run listing; retain application job IDs and retrieve individual runs');
  }
  override listActiveWorkflowRuns(): never {
    return unsupported('provider-wide active run listing');
  }
  override deleteWorkflowRunById(): never {
    return unsupported('deleting a run without coordinating provider history and snapshots');
  }
}
