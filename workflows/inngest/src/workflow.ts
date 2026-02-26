import { randomUUID } from 'node:crypto';
import { emitErrorEvent } from '@mastra/core/agent/durable';
import { RequestContext } from '@mastra/core/di';
import type { Mastra } from '@mastra/core/mastra';
import { SpanType, EntityType } from '@mastra/core/observability';
import type { WorkflowRuns } from '@mastra/core/storage';
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
import { InngestExecutionEngine } from './execution-engine';
import { InngestPubSub } from './pubsub';
import { InngestRun } from './run';
import type {
  InngestEngineType,
  InngestFlowControlConfig,
  InngestFlowCronConfig,
  InngestWorkflowConfig,
} from './types';

export class InngestWorkflow<
  TEngineType = InngestEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TWorkflowId extends string = string,
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TPrevSchema = TInput,
> extends Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> {
  #mastra: Mastra;
  public inngest: Inngest;

  private function: ReturnType<Inngest['createFunction']> | undefined;
  private cronFunction: ReturnType<Inngest['createFunction']> | undefined;
  private readonly flowControlConfig?: InngestFlowControlConfig;
  private readonly cronConfig?: InngestFlowCronConfig<TInput, TState>;

  constructor(params: InngestWorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>, inngest: Inngest) {
    const { concurrency, rateLimit, throttle, debounce, priority, cron, inputData, initialState, ...workflowParams } =
      params;

    super(workflowParams as WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>);

    this.engineType = 'inngest';

    const flowControlEntries = Object.entries({ concurrency, rateLimit, throttle, debounce, priority }).filter(
      ([_, value]) => value !== undefined,
    );

    this.flowControlConfig = flowControlEntries.length > 0 ? Object.fromEntries(flowControlEntries) : undefined;

    this.#mastra = params.mastra!;
    this.inngest = inngest;

    if (cron) {
      this.cronConfig = { cron, inputData, initialState };
    }
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

    const workflowsStore = await storage.getStore('workflows');
    if (!workflowsStore) {
      return { runs: [], total: 0 };
    }
    return workflowsStore.listWorkflowRuns({ workflowName: this.id, ...(args ?? {}) }) as unknown as WorkflowRuns;
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
    const existingInMemoryRun = this.runs.get(runIdToUse);
    const newRun = new InngestRun<TEngineType, TSteps, TState, TInput, TOutput>(
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
    const run = (existingInMemoryRun ?? newRun) as Run<TEngineType, TSteps, TState, TInput, TOutput>;

    this.runs.set(runIdToUse, run);

    const shouldPersistSnapshot = this.options.shouldPersistSnapshot({
      workflowStatus: run.workflowRunStatus,
      stepResults: {},
    });

    const existingStoredRun = await this.getWorkflowRunById(runIdToUse, {
      withNestedWorkflows: false,
    });

    // Check if run exists in persistent storage (not just in-memory)
    const existsInStorage = existingStoredRun && !existingStoredRun.isFromInMemory;

    if (!existsInStorage && shouldPersistSnapshot) {
      const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
      await workflowsStore?.persistWorkflowSnapshot({
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

  //createCronFunction is only called if cronConfig.cron is defined.
  private createCronFunction() {
    if (this.cronFunction) {
      return this.cronFunction;
    }
    this.cronFunction = this.inngest.createFunction(
      {
        id: `workflow.${this.id}.cron`,
        retries: 0,
        cancelOn: [{ event: `cancel.workflow.${this.id}` }],
        ...this.flowControlConfig,
      },
      { cron: this.cronConfig?.cron ?? '' },
      async () => {
        const run = await this.createRun();
        // @ts-expect-error - cron inputData type mismatch
        const result = await run.start({
          inputData: this.cronConfig?.inputData,
          initialState: this.cronConfig?.initialState,
        });
        return { result, runId: run.runId };
      },
    );
    return this.cronFunction;
  }

  getFunction() {
    if (this.function) {
      return this.function;
    }

    // Always set function-level retries to 0, since retries are handled at the step level via executeStepWithRetry
    // which uses either step.retries or retryConfig.attempts (step.retries takes precedence).
    // step.retries is not accessible at function level, so we handle retries manually in executeStepWithRetry.
    // This is why we set retries to 0 here.
    this.function = this.inngest.createFunction(
      {
        id: `workflow.${this.id}`,
        retries: 0,
        cancelOn: [{ event: `cancel.workflow.${this.id}` }],
        // Spread flow control configuration
        ...this.flowControlConfig,
      },
      { event: `workflow.${this.id}` },
      async ({ event, step, attempt, publish }) => {
        let {
          inputData,
          initialState,
          runId,
          resourceId,
          resume,
          outputOptions,
          format,
          timeTravel,
          perStep,
          tracingOptions,
        } = event.data;

        if (!runId) {
          runId = await step.run(`workflow.${this.id}.runIdGen`, async () => {
            return randomUUID();
          });
        }

        // Create InngestPubSub instance with the publish function from Inngest context
        const pubsub = new InngestPubSub(this.inngest, this.id, publish);

        // Create requestContext before execute so we can reuse it in finalize
        const requestContext: RequestContext = new RequestContext(Object.entries(event.data.requestContext ?? {}));

        // Store mastra reference for use in proxy closure
        const mastra = this.#mastra;
        const tracingPolicy = this.options.tracingPolicy;

        // Create the workflow root span durably - exports SPAN_STARTED immediately on first execution
        // On replay, returns memoized ExportedSpan data without re-creating the span
        const workflowSpanData = await step.run(`workflow.${this.id}.span.start`, async () => {
          const observability = mastra?.observability?.getSelectedInstance({ requestContext });
          if (!observability) return undefined;

          const span = observability.startSpan({
            type: SpanType.WORKFLOW_RUN,
            name: `workflow run: '${this.id}'`,
            entityType: EntityType.WORKFLOW_RUN,
            entityId: this.id,
            input: inputData,
            metadata: {
              resourceId,
              runId,
            },
            tracingPolicy,
            tracingOptions,
            requestContext,
          });

          return span?.exportSpan();
        });

        const engine = new InngestExecutionEngine(this.#mastra, step, attempt, this.options);

        let result: WorkflowResult<TState, TInput, TOutput, TSteps>;
        try {
          result = await engine.execute<TState, TInput, WorkflowResult<TState, TInput, TOutput, TSteps>>({
            workflowId: this.id,
            runId,
            resourceId,
            graph: this.executionGraph,
            serializedStepGraph: this.serializedStepGraph,
            input: inputData,
            initialState,
            pubsub,
            retryConfig: this.retryConfig,
            requestContext,
            resume,
            timeTravel,
            perStep,
            format,
            abortController: new AbortController(),
            // For Inngest, we don't pass workflowSpan - step spans use tracingIds instead
            workflowSpan: undefined,
            // Pass tracing IDs for durable span operations
            tracingIds: workflowSpanData
              ? {
                  traceId: workflowSpanData.traceId,
                  workflowSpanId: workflowSpanData.id,
                }
              : undefined,
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
        } catch (executionError) {
          // Execution threw an exception (not just returned failed status)
          // Create a failed result to pass to finalize
          result = {
            status: 'failed',
            steps: {},
            state: initialState ?? {},
            error: executionError instanceof Error ? executionError : new Error(String(executionError)),
          } as WorkflowResult<TState, TInput, TOutput, TSteps>;
        }

        // Final step to invoke lifecycle callbacks and end workflow span.
        // This step is memoized by step.run.
        await step.run(`workflow.${this.id}.finalize`, async () => {
          // For durable agent workflows, emit error event on failure so the
          // client's stream can receive the error and close properly.
          // Use inputData.runId (the agent's run ID) not the workflow's runId for agent streams.
          if (result.status === 'failed' && inputData?.__workflowKind === 'durable-agent' && inputData?.runId) {
            const error = result.error instanceof Error ? result.error : new Error(String(result.error));
            try {
              await emitErrorEvent(pubsub, inputData.runId, error);
            } catch (e) {
              this.logger.debug?.('Failed to emit error event:', e);
            }
          }

          if (result.status !== 'paused') {
            // Invoke lifecycle callbacks (onFinish and onError)
            await engine.invokeLifecycleCallbacksInternal({
              status: result.status,
              result: 'result' in result ? result.result : undefined,
              error: 'error' in result ? result.error : undefined,
              steps: result.steps,
              tripwire: 'tripwire' in result ? result.tripwire : undefined,
              runId,
              workflowId: this.id,
              resourceId,
              input: inputData,
              requestContext,
              state: result.state ?? initialState ?? {},
            });
          }

          // End the workflow span with appropriate status
          // The workflow span was already created and SPAN_STARTED was exported in the span.start step
          if (workflowSpanData) {
            const observability = mastra?.observability?.getSelectedInstance({ requestContext });
            if (observability) {
              // Rebuild the span from cached data to call end/error
              const workflowSpan = observability.rebuildSpan(workflowSpanData);

              if (result.status === 'failed') {
                workflowSpan.error({
                  error: result.error instanceof Error ? result.error : new Error(String(result.error)),
                  attributes: { status: 'failed' },
                });
              } else {
                workflowSpan.end({
                  output: result.status === 'success' ? result.result : undefined,
                  attributes: { status: result.status },
                });
              }
            }
          }

          // Ensure final snapshot is persisted BEFORE publishing workflow-finish
          // This fixes a race condition where getRunOutput reads the snapshot before it's fully written
          const shouldPersistFinalSnapshot = this.options.shouldPersistSnapshot({
            workflowStatus: result.status as any,
            stepResults: result.steps,
          });
          if (shouldPersistFinalSnapshot) {
            const workflowsStore = await mastra?.getStorage()?.getStore('workflows');
            if (workflowsStore) {
              // For suspended workflows, read existing snapshot to preserve suspendedPaths and resumeLabels
              // which were set correctly by the handlers during execution
              let existingSnapshot:
                | { suspendedPaths?: Record<string, number[]>; resumeLabels?: Record<string, any> }
                | undefined;
              if (result.status === 'suspended') {
                existingSnapshot =
                  (await workflowsStore.loadWorkflowSnapshot({
                    workflowName: this.id,
                    runId,
                  })) ?? undefined;
              }

              await workflowsStore.persistWorkflowSnapshot({
                workflowName: this.id,
                runId,
                resourceId,
                snapshot: {
                  runId,
                  status: result.status,
                  value: result.state ?? initialState ?? {},
                  context: result.steps as any,
                  activePaths: [],
                  activeStepsPath: {},
                  serializedStepGraph: this.serializedStepGraph,
                  suspendedPaths: existingSnapshot?.suspendedPaths ?? {},
                  waitingPaths: {},
                  resumeLabels: existingSnapshot?.resumeLabels ?? result.resumeLabels ?? {},
                  result: result.status === 'success' ? (result.result as any) : undefined,
                  error: result.status === 'failed' ? result.error : undefined,
                  timestamp: Date.now(),
                },
              });
            }
          }

          // Publish workflow-finish event for realtime subscribers
          await pubsub.publish(`workflow.events.v2.${runId}`, {
            type: 'watch',
            runId,
            data: {
              type: 'workflow-finish',
              payload: {
                status: result.status,
                result: result.status === 'success' ? result.result : undefined,
                error: result.status === 'failed' ? result.error : undefined,
              },
            },
          });

          // Throw after span ended for failed workflows
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
    return [
      this.getFunction(),
      ...(this.cronConfig?.cron ? [this.createCronFunction()] : []),
      ...this.getNestedFunctions(this.executionGraph.steps),
    ];
  }
}
