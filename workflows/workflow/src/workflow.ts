import { randomUUID } from 'node:crypto';
import type { Mastra } from '@mastra/core/mastra';
import { Workflow } from '@mastra/core/workflows';
import type { Step, StepFlowEntry, WorkflowConfig } from '@mastra/core/workflows';
import { WORKFLOW_SDK_ENGINE_TYPE } from './constants';
import { WorkflowSdkExecutionEngine } from './execution-engine';
import { registerWorkflow, type RegisteredMastraWorkflow } from './registry';
import { WorkflowSdkRun } from './run';
import type { WorkflowSdkEngineType } from './types';

/** Runner reference threaded through `init({ runner })`. */
export type WorkflowSdkRunnerRef = (...args: any[]) => Promise<any>;

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
            shouldPersistSnapshot: () => true,
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
    for (const entry of this.executionGraph.steps) {
      registerNested(entry, mastra);
    }
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
    const visit = (entry: StepFlowEntry) => {
      if (entry.type === 'step' || entry.type === 'loop' || entry.type === 'foreach') {
        if (typeof entry.step.retries === 'number') {
          retries[entry.step.id] = entry.step.retries;
        }
      } else if (entry.type === 'parallel' || entry.type === 'conditional') {
        entry.steps.forEach(visit);
      }
    };
    this.executionGraph.steps.forEach(visit);
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
      { stepRetries: this.#collectStepRetries() },
    );

    this.runs.set(runId, run);
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
