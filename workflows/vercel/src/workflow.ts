import { randomUUID } from 'node:crypto';
import type { Mastra } from '@mastra/core/mastra';
import { Workflow } from '@mastra/core/workflows';
import type {
  WorkflowConfig,
  Step,
  StepFlowEntry,
  Run,
  ExecutionGraph,
  SerializedStepFlowEntry,
} from '@mastra/core/workflows';
import type { z } from 'zod';
import { VercelRun } from './run';
import type { VercelWorkflowConfig, VercelEngineType } from './types';

/**
 * VercelWorkflow
 *
 * A workflow that runs with Vercel's durable execution capabilities.
 * Uses the "use workflow" and "use step" directives for automatic
 * memoization and retry handling.
 *
 * Note: The VercelExecutionEngine is created lazily by mainWorkflow(),
 * not in this constructor. This allows workflows to be created before
 * the Mastra instance (which is needed for the singleton pattern).
 */
export class VercelWorkflow<
  TEngineType = VercelEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TWorkflowId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TPrevSchema extends z.ZodType<any> = TInput,
> extends Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> {
  #mastra?: Mastra;

  constructor(params: VercelWorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>) {
    // Don't pass executionEngine - base class creates DefaultExecutionEngine
    // The actual VercelExecutionEngine is created lazily by mainWorkflow()
    super(params as WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>);

    this.engineType = 'vercel' as any;
    this.#mastra = params.mastra;
  }

  /**
   * Get the execution graph for this workflow.
   * This is a public accessor for the protected property.
   */
  getExecutionGraph(): ExecutionGraph {
    return this.executionGraph;
  }

  /**
   * Get the serialized step graph for this workflow.
   * This is a public accessor for the protected property.
   */
  getSerializedStepGraph(): SerializedStepFlowEntry[] {
    return this.serializedStepFlow;
  }

  /**
   * Register Mastra instance with this workflow.
   */
  __registerMastra(mastra: Mastra) {
    this.#mastra = mastra;
    // Call parent which handles executionEngine registration
    super.__registerMastra(mastra);

    // Also register with nested VercelWorkflows
    const updateNested = (step: StepFlowEntry) => {
      if (
        (step.type === 'step' || step.type === 'loop' || step.type === 'foreach') &&
        step.step instanceof VercelWorkflow
      ) {
        step.step.__registerMastra(mastra);
      } else if (step.type === 'parallel' || step.type === 'conditional') {
        for (const subStep of step.steps) {
          updateNested(subStep);
        }
      }
    };

    if (this.executionGraph.steps.length) {
      for (const step of this.executionGraph.steps) {
        updateNested(step);
      }
    }
  }

  /**
   * Create a new run instance for this workflow.
   */
  async createRun(options?: {
    runId?: string;
    resourceId?: string;
  }): Promise<Run<TEngineType, TSteps, TState, TInput, TOutput>> {
    const runIdToUse = options?.runId || randomUUID();

    // Check if run already exists
    const existingRun = this.runs.get(runIdToUse);
    if (existingRun) {
      return existingRun as Run<TEngineType, TSteps, TState, TInput, TOutput>;
    }

    const run = new VercelRun<TEngineType, TSteps, TState, TInput, TOutput>({
      workflowId: this.id,
      runId: runIdToUse,
      resourceId: options?.resourceId,
      executionEngine: this.executionEngine,
      executionGraph: this.executionGraph,
      serializedStepGraph: this.serializedStepGraph,
      mastra: this.#mastra,
      retryConfig: this.retryConfig,
      cleanup: () => this.runs.delete(runIdToUse),
      workflowSteps: this.steps,
      workflowEngineType: this.engineType as any,
      validateInputs: this.options.validateInputs,
    });

    this.runs.set(runIdToUse, run as any);

    // Persist initial snapshot if storage is available
    const shouldPersistSnapshot = this.options.shouldPersistSnapshot({
      workflowStatus: run.workflowRunStatus,
      stepResults: {},
    });

    if (shouldPersistSnapshot && this.#mastra?.getStorage()) {
      const existingSnapshot = await this.#mastra.getStorage()?.loadWorkflowSnapshot({
        workflowName: this.id,
        runId: runIdToUse,
      });

      if (!existingSnapshot) {
        await this.#mastra.getStorage()?.persistWorkflowSnapshot({
          workflowName: this.id,
          runId: runIdToUse,
          resourceId: options?.resourceId,
          snapshot: {
            runId: runIdToUse,
            status: 'pending',
            value: {},
            context: {},
            activePaths: [],
            activeStepsPath: {},
            waitingPaths: {},
            serializedStepGraph: this.serializedStepGraph,
            suspendedPaths: {},
            resumeLabels: {},
            result: undefined,
            error: undefined,
            timestamp: Date.now(),
          },
        });
      }
    }

    return run as Run<TEngineType, TSteps, TState, TInput, TOutput>;
  }
}
