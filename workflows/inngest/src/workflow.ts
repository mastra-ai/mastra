import { randomUUID } from 'node:crypto';
import { RequestContext } from '@mastra/core/di';
import type { Mastra } from '@mastra/core/mastra';
import type { WorkflowRun, WorkflowRuns } from '@mastra/core/storage';
import { Workflow } from '@mastra/core/workflows';
import type {
  Step,
  WorkflowConfig,
  StepFlowEntry,
  WorkflowResult,
  WorkflowStreamEvent,
  Run,
} from '@mastra/core/workflows';
import { NonRetriableError } from 'inngest';
import type { Inngest } from 'inngest';
import type { z } from 'zod';
import { InngestExecutionEngine } from './execution-engine';
import { InngestPubSub } from './pubsub';
import { InngestRun } from './run';
import type { InngestEngineType, InngestFlowControlConfig, InngestWorkflowConfig } from './types';

export class InngestWorkflow<
  TEngineType = InngestEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TWorkflowId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TPrevSchema extends z.ZodType<any> = TInput,
> extends Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> {
  #mastra: Mastra;
  public inngest: Inngest;

  private function: ReturnType<Inngest['createFunction']> | undefined;
  private readonly flowControlConfig?: InngestFlowControlConfig;

  constructor(params: InngestWorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>, inngest: Inngest) {
    const { concurrency, rateLimit, throttle, debounce, priority, ...workflowParams } = params;

    super(workflowParams as WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>);

    this.engineType = 'inngest';

    const flowControlEntries = Object.entries({ concurrency, rateLimit, throttle, debounce, priority }).filter(
      ([_, value]) => value !== undefined,
    );

    this.flowControlConfig = flowControlEntries.length > 0 ? Object.fromEntries(flowControlEntries) : undefined;

    this.#mastra = params.mastra!;
    this.inngest = inngest;
  }

  async listWorkflowRuns(args?: {
    fromDate?: Date;
    toDate?: Date;
    perPage?: number | false;
    page?: number;
    resourceId?: string;
  }) {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      this.logger.debug('Cannot get workflow runs. Mastra engine is not initialized');
      return { runs: [], total: 0 };
    }

    return storage.listWorkflowRuns({ workflowName: this.id, ...(args ?? {}) }) as unknown as WorkflowRuns;
  }

  async getWorkflowRunById(runId: string): Promise<WorkflowRun | null> {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      this.logger.debug('Cannot get workflow runs. Mastra engine is not initialized');
      //returning in memory run if no storage is initialized
      return this.runs.get(runId)
        ? ({ ...this.runs.get(runId), workflowName: this.id } as unknown as WorkflowRun)
        : null;
    }
    const run = (await storage.getWorkflowRunById({ runId, workflowName: this.id })) as unknown as WorkflowRun;

    return (
      run ??
      (this.runs.get(runId) ? ({ ...this.runs.get(runId), workflowName: this.id } as unknown as WorkflowRun) : null)
    );
  }

  __registerMastra(mastra: Mastra) {
    super.__registerMastra(mastra);
    this.#mastra = mastra;
    this.executionEngine.__registerMastra(mastra);
    const updateNested = (step: StepFlowEntry) => {
      if (
        (step.type === 'step' || step.type === 'loop' || step.type === 'foreach') &&
        step.step instanceof InngestWorkflow
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

  async createRun(options?: {
    runId?: string;
    resourceId?: string;
  }): Promise<Run<TEngineType, TSteps, TState, TInput, TOutput>> {
    const runIdToUse = options?.runId || randomUUID();

    // Return a new Run instance with object parameters
    const run: Run<TEngineType, TSteps, TState, TInput, TOutput> =
      this.runs.get(runIdToUse) ??
      new InngestRun(
        {
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
          workflowEngineType: this.engineType,
          validateInputs: this.options.validateInputs,
        },
        this.inngest,
      );

    this.runs.set(runIdToUse, run);

    const shouldPersistSnapshot = this.options.shouldPersistSnapshot({
      workflowStatus: run.workflowRunStatus,
      stepResults: {},
    });

    const workflowSnapshotInStorage = await this.getWorkflowRunExecutionResult(runIdToUse, {
      withNestedWorkflows: false,
    });

    if (!workflowSnapshotInStorage && shouldPersistSnapshot) {
      await this.mastra?.getStorage()?.persistWorkflowSnapshot({
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

    return run;
  }

  getFunction() {
    if (this.function) {
      return this.function;
    }
    this.function = this.inngest.createFunction(
      {
        id: `workflow.${this.id}`,
        retries: Math.min(this.retryConfig?.attempts ?? 0, 20) as
          | 0
          | 1
          | 2
          | 3
          | 4
          | 5
          | 6
          | 7
          | 8
          | 9
          | 10
          | 11
          | 12
          | 13
          | 14
          | 15
          | 16
          | 17
          | 18
          | 19
          | 20,
        cancelOn: [{ event: `cancel.workflow.${this.id}` }],
        // Spread flow control configuration
        ...this.flowControlConfig,
      },
      { event: `workflow.${this.id}` },
      async ({ event, step, attempt, publish }) => {
        let { inputData, initialState, runId, resourceId, resume, outputOptions, format, timeTravel } = event.data;

        if (!runId) {
          runId = await step.run(`workflow.${this.id}.runIdGen`, async () => {
            return randomUUID();
          });
        }

        // Create InngestPubSub instance with the publish function from Inngest context
        const pubsub = new InngestPubSub(this.inngest, this.id, publish);

        const engine = new InngestExecutionEngine(this.#mastra, step, attempt, this.options);
        const result = await engine.execute<
          z.infer<TState>,
          z.infer<TInput>,
          WorkflowResult<TState, TInput, TOutput, TSteps>
        >({
          workflowId: this.id,
          runId,
          resourceId,
          graph: this.executionGraph,
          serializedStepGraph: this.serializedStepGraph,
          input: inputData,
          initialState,
          pubsub,
          retryConfig: this.retryConfig,
          requestContext: new RequestContext(Object.entries(event.data.requestContext ?? {})),
          resume,
          timeTravel,
          format,
          abortController: new AbortController(),
          // currentSpan: undefined, // TODO: Pass actual parent Span from workflow execution context
          outputOptions,
          outputWriter: async (chunk: WorkflowStreamEvent) => {
            try {
              await pubsub.publish(`workflow.events.v2.${runId}`, {
                type: 'watch',
                runId,
                data: chunk,
              });
            } catch (err) {
              this.logger.debug?.('Failed to publish watch event:', err);
            }
          },
        });

        // Final step to invoke lifecycle callbacks and check workflow status
        // Wrapped in step.run for durability - callbacks are memoized on replay
        await step.run(`workflow.${this.id}.finalize`, async () => {
          // Invoke lifecycle callbacks (onFinish and onError)
          // Use invokeLifecycleCallbacksInternal to call the real implementation
          // (invokeLifecycleCallbacks is overridden to no-op to prevent double calling)
          await engine.invokeLifecycleCallbacksInternal(result as any);

          // Throw NonRetriableError if failed to ensure Inngest marks the run as failed
          if (result.status === 'failed') {
            throw new NonRetriableError(`Workflow failed`, {
              cause: result,
            });
          }
          return result;
        });

        return { result, runId };
      },
    );
    return this.function;
  }

  getNestedFunctions(steps: StepFlowEntry[]): ReturnType<Inngest['createFunction']>[] {
    return steps.flatMap(step => {
      if (step.type === 'step' || step.type === 'loop' || step.type === 'foreach') {
        if (step.step instanceof InngestWorkflow) {
          return [step.step.getFunction(), ...step.step.getNestedFunctions(step.step.executionGraph.steps)];
        }
        return [];
      } else if (step.type === 'parallel' || step.type === 'conditional') {
        return this.getNestedFunctions(step.steps);
      }

      return [];
    });
  }

  getFunctions() {
    return [this.getFunction(), ...this.getNestedFunctions(this.executionGraph.steps)];
  }
}
