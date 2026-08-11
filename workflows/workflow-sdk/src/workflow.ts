import { randomUUID } from 'node:crypto';
import type { Mastra } from '@mastra/core/mastra';
import { getEntryId, Workflow } from '@mastra/core/workflows';
import type { Step, StepFlowEntry, WorkflowConfig, WorkflowRunState, WorkflowRunStatus } from '@mastra/core/workflows';
import { WORKFLOW_SDK_ENGINE_TYPE } from './constants';
import { WorkflowSdkExecutionEngine } from './execution-engine';
import { registerWorkflow, type RegisteredMastraWorkflow } from './registry';
import { WorkflowSdkRun } from './run';
import type { WorkflowSdkEngineType, WorkflowSdkRunnerRef } from './types';

export type { WorkflowSdkRunnerRef };

export interface WorkflowSdkWorkflowParams {
  /**
   * The `mastraRunner` workflow function, imported from the consumer's own
   * `workflows/` re-export so it carries their build's stable workflow id.
   */
  runner: WorkflowSdkRunnerRef;
}

export class WorkflowSdkWorkflow<
  TSteps extends Step<string, any, any, any, any, any, WorkflowSdkEngineType, any>[] = Step<
    string,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    WorkflowSdkEngineType
  >[],
  TWorkflowId extends string = string,
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TPrevSchema = TInput,
  TRequestContext extends Record<string, any> | unknown = unknown,
> extends Workflow<WorkflowSdkEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema, TRequestContext> {
  readonly runner: WorkflowSdkRunnerRef;

  constructor(
    params: WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps, TRequestContext>,
    sdkParams: WorkflowSdkWorkflowParams,
  ) {
    super({
      ...params,
      executionEngine:
        params.executionEngine ??
        new WorkflowSdkExecutionEngine({
          mastra: params.mastra,
          options: {
            validateInputs: params.options?.validateInputs ?? true,
            shouldPersistSnapshot: params.options?.shouldPersistSnapshot ?? (() => true),
            // Lifecycle callbacks run host-side when the dispatcher finalizes
            // or suspends the run (see executor.ts).
            onFinish: params.options?.onFinish,
            onError: params.options?.onError,
          },
        }),
    });

    this.engineType = WORKFLOW_SDK_ENGINE_TYPE;
    this.runner = sdkParams.runner;
  }

  /**
   * Live view of this workflow for the registry.
   *
   * Built here because `executionGraph` and `serializedStepGraph` are protected
   * on `Workflow`; the getters keep the entry current as the workflow is
   * committed and wired to a Mastra instance.
   */
  #registryEntry(): RegisteredMastraWorkflow {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      get id() {
        return self.id;
      },
      get executionGraph() {
        return self.executionGraph;
      },
      get serializedStepGraph() {
        return self.serializedStepGraph;
      },
      get mastra() {
        return self.mastra;
      },
      get executionEngine() {
        return self.executionEngine;
      },
    };
  }

  /**
   * `commit()` finalizes the step graph, which is the first moment the
   * workflow is complete enough for a step to resolve callables out of it.
   * Registering here — rather than in the constructor — means the registry
   * never hands back a half-built graph.
   */
  commit() {
    const committed = super.commit();
    registerWorkflow(this.#registryEntry());
    return committed;
  }

  __registerMastra(mastra: Mastra): void {
    super.__registerMastra(mastra);
    registerWorkflow(this.#registryEntry());
    // An uncommitted workflow has no graph yet; `createRun()` rejects it later
    // with a clearer error than a TypeError here would be.
    for (const entry of this.executionGraph?.steps ?? []) {
      registerNested(entry, mastra);
    }
  }

  /**
   * This engine records nested workflow step results flat in the parent run's
   * snapshot under dotted ids (`outer-wf.inner-step`), whereas the default
   * engine keeps them in separate nested runs. The base implementation only
   * knows the latter, so `withNestedWorkflows: false` must drop the dotted
   * entries here.
   */
  async getWorkflowRunById(
    runId: string,
    options: Parameters<Workflow['getWorkflowRunById']>[1] = {},
  ): ReturnType<Workflow['getWorkflowRunById']> {
    const result = await super.getWorkflowRunById(runId, options);
    if (result?.steps && options.withNestedWorkflows === false) {
      for (const key of Object.keys(result.steps)) {
        if (key.includes('.')) {
          delete result.steps[key];
        }
      }
    }
    return result;
  }

  /**
   * Per-step retry counts, keyed by step id.
   *
   * The serialized graph the sandbox receives drops `retries`, so the walker
   * cannot read it from there. Collecting it here and passing it as run input
   * keeps retry policy where authors declared it.
   */
  #collectStepRetries(): Record<string, number> {
    const retries: Record<string, number> = {};
    const visit = (entry: StepFlowEntry, prefix: string) => {
      if (entry.type === 'step' || entry.type === 'loop' || entry.type === 'foreach') {
        const inner = entry.type === 'step' ? entry : entry.step;
        const stepId = getEntryId(inner);
        const id = prefix ? `${prefix}.${stepId}` : stepId;
        const live = inner.type === 'step' ? inner.step : undefined;
        if (live && typeof live.retries === 'number') {
          retries[id] = live.retries;
        }
        // Nested workflow steps are interpreted inline by the walker, which
        // looks retries up by qualified dotted id.
        if (live instanceof WorkflowSdkWorkflow) {
          live.executionGraph.steps.forEach(nested => visit(nested, id));
        }
      } else if (entry.type === 'parallel' || entry.type === 'conditional') {
        entry.steps.forEach(sub => visit(sub, prefix));
      }
    };
    this.executionGraph.steps.forEach(entry => visit(entry, ''));
    return retries;
  }

  /**
   * The return type is spelled out so callers keep the `WorkflowSdkRun` surface
   * — `sdkRunId` in particular. Inference would widen it to the base `Run`,
   * because that is how the cache below is typed.
   */
  async createRun(options?: {
    runId?: string;
    resourceId?: string;
    disableScorers?: boolean;
  }): Promise<WorkflowSdkRun<TSteps, TState, TInput, TOutput, TRequestContext>> {
    if (this.stepFlow.length === 0) {
      throw new Error(
        'Execution flow of workflow is not defined. Add steps to the workflow via .then(), .branch(), etc.',
      );
    }
    if (!this.executionGraph.steps) {
      throw new Error('Uncommitted step flow changes detected. Call .commit() to register the steps.');
    }

    const runId = options?.runId ?? randomUUID();
    const existing = this.runs.get(runId);
    if (existing) {
      return existing as WorkflowSdkRun<TSteps, TState, TInput, TOutput, TRequestContext>;
    }

    const run = new WorkflowSdkRun<TSteps, TState, TInput, TOutput, TRequestContext>(
      {
        workflowId: this.id,
        runId,
        resourceId: options?.resourceId,
        stateSchema: this.stateSchema,
        inputSchema: this.inputSchema,
        requestContextSchema: this.requestContextSchema,
        executionEngine: this.executionEngine,
        executionGraph: this.executionGraph,
        serializedStepGraph: this.serializedStepGraph,
        mastra: this.mastra,
        retryConfig: this.retryConfig,
        disableScorers: options?.disableScorers,
        tracingPolicy: this.options.tracingPolicy,
        workflowSteps: this.steps,
        workflowEngineType: this.engineType,
        validateInputs: this.options.validateInputs,
        cleanup: () => this.runs.delete(runId),
      },
      { runner: this.runner, stepRetries: this.#collectStepRetries() },
    );

    this.runs.set(runId, run);

    // Mirror the default engine's createRun behavior: make the run visible in
    // storage as `pending` before it starts, and pick up the stored status when
    // the caller passes the id of a run that already exists there.
    const shouldPersistSnapshot = this.options.shouldPersistSnapshot({
      workflowStatus: run.workflowRunStatus,
      stepResults: {},
    });

    const existingRun =
      shouldPersistSnapshot || options?.runId
        ? await this.getWorkflowRunById(runId, { withNestedWorkflows: false })
        : undefined;
    const existsInStorage = existingRun && !existingRun.isFromInMemory;

    if (existsInStorage && existingRun.status) {
      run.workflowRunStatus = existingRun.status as WorkflowRunStatus;
    }

    if (!existsInStorage && shouldPersistSnapshot) {
      const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
      const initialSnapshot: WorkflowRunState = {
        runId,
        status: 'pending',
        value: {},
        context: {} as WorkflowRunState['context'],
        activePaths: [],
        activeStepsPath: {},
        serializedStepGraph: this.serializedStepGraph,
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        result: undefined,
        error: undefined,
        timestamp: Date.now(),
      };
      await workflowsStore?.persistWorkflowSnapshot({
        workflowName: this.id,
        runId,
        resourceId: options?.resourceId,
        snapshot: this.options.pruneSnapshot
          ? this.options.pruneSnapshot({ snapshot: initialSnapshot, workflowStatus: 'pending' })
          : initialSnapshot,
      });
    }

    return run;
  }
}

function registerNested(entry: StepFlowEntry, mastra: Mastra): void {
  if (entry.type === 'step' || entry.type === 'loop' || entry.type === 'foreach') {
    if (entry.step instanceof WorkflowSdkWorkflow) {
      entry.step.__registerMastra(mastra);
    }
  } else if (entry.type === 'parallel' || entry.type === 'conditional') {
    entry.steps.forEach(sub => registerNested(sub, mastra));
  }
}
