import { randomUUID } from 'node:crypto';
import { RequestContext } from '@mastra/core/di';
import type { Mastra } from '@mastra/core/mastra';
import { getOrCreateSpan, SpanType, EntityType } from '@mastra/core/observability';
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
import { SpanCollector, type CollectedSpanData } from './span-collector';
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
        // @ts-ignore
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

        // Memoize span identity on first invocation.
        // This captures the workflow start time and generates consistent IDs for the workflow span.
        // Key insight from Inngest's tracing: separate span identity (IDs) from span objects.
        // Child spans can reference the parent by ID even when the parent object doesn't exist.
        const spanMeta = await step.run(`workflow.${this.id}.spanMeta`, async () => ({
          startTime: Date.now(),
          // Generate consistent IDs that will be used for the workflow span
          traceId: tracingOptions?.traceId ?? randomUUID().replace(/-/g, ''),
          spanId: randomUUID().replace(/-/g, '').slice(0, 16), // 16 hex chars
        }));

        // Create a SpanCollector to collect span metadata during execution.
        // Due to Inngest's replay model, we can't create real spans during execution
        // (they would be duplicated on each replay). Instead, we collect the metadata
        // and create real spans with proper hierarchy in the finalize step.
        const spanCollector = new SpanCollector(spanMeta.traceId);

        // Create a collector span that will serve as the workflow root span.
        // This span collects child span metadata during execution.
        const collectorWorkflowSpan = spanCollector.createRootSpan({
          name: `workflow run: '${this.id}'`,
          type: SpanType.WORKFLOW_RUN,
          entityType: EntityType.WORKFLOW_RUN,
          entityId: this.id,
          input: inputData,
          metadata: {
            resourceId,
            runId,
          },
        });

        // Create a proxy span that delegates to the collector.
        // This implements the Span interface expected by the execution engine,
        // but instead of creating real spans, it collects metadata in the collector.
        const proxyWorkflowSpan = {
          id: spanMeta.spanId,
          traceId: spanMeta.traceId,
          createChildSpan: (childOptions: { name: string; type: SpanType; [key: string]: any }) => {
            // Delegate to the collector span to create a child
            // This records the span metadata for later reconstruction
            return collectorWorkflowSpan.createChildSpan(childOptions as any);
          },
          // No-op methods - actual span lifecycle is managed in finalize step
          end: () => collectorWorkflowSpan.end(),
          error: (opts: any) => collectorWorkflowSpan.error(opts),
          update: (opts: any) => collectorWorkflowSpan.update(opts),
        };

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
            workflowSpan: proxyWorkflowSpan as any, // Proxy span for child span creation
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
        } catch (error) {
          // Re-throw - span will be created in finalize if we reach it
          throw error;
        }

        // Final step to invoke lifecycle callbacks and check workflow status.
        // This is also where we create real spans from the collected data with proper hierarchy.
        // The spans are created once here (finalize is memoized by step.run).
        await step.run(`workflow.${this.id}.finalize`, async () => {
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

          // Helper function to recursively create real spans from collected data.
          // Uses step result timing (memoized by Inngest) instead of collected timing (replay time).
          const createRealSpansFromCollected = (
            collectedData: CollectedSpanData,
            parentSpan: any,
            stepResults: typeof result.steps,
          ) => {
            // Create the real span as a child of the parent
            const realSpan = parentSpan.createChildSpan({
              name: collectedData.name,
              type: collectedData.type,
              entityType: collectedData.entityType,
              entityId: collectedData.entityId,
              entityName: collectedData.entityName,
              input: collectedData.input,
              attributes: collectedData.attributes,
              metadata: collectedData.metadata,
            });

            // Look up step result by entityId (which is the step ID for step spans)
            const stepResult = collectedData.entityId
              ? (stepResults as Record<string, any>)[collectedData.entityId]
              : undefined;

            // Use step result timing if available (memoized), otherwise fall back to collected timing
            const startTime = stepResult?.startedAt ?? collectedData.startTime;
            const endTime = stepResult?.endedAt ?? collectedData.endTime;

            // Set the correct start time
            if (realSpan && 'startTime' in realSpan) {
              (realSpan as any).startTime = new Date(startTime);
            }

            // First, recursively create all child spans
            for (const childData of collectedData.children) {
              createRealSpansFromCollected(childData, realSpan, stepResults);
            }

            // Then end this span with the collected status
            if (collectedData.status === 'error' && collectedData.error) {
              realSpan?.error({
                error: collectedData.error,
                attributes: collectedData.attributes,
              });
            } else if (endTime) {
              realSpan?.end({
                output: collectedData.output,
                attributes: collectedData.attributes,
              });
            }
          };

          // Create the actual workflow span with memoized IDs.
          // This will be the root span, and all collected child spans will be attached to it.
          const workflowSpan = getOrCreateSpan({
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
            tracingOptions: {
              ...tracingOptions,
              traceId: spanMeta.traceId,
            },
            requestContext,
            mastra,
          });

          // Set the start time to when the workflow actually started
          if (workflowSpan && 'startTime' in workflowSpan) {
            (workflowSpan as any).startTime = new Date(spanMeta.startTime);
          }

          // Create real spans from all collected child span data.
          // The workflow root span was collected too, so we only process its children here.
          const collectedRootSpans = spanCollector.getCollectedData();
          if (collectedRootSpans.length > 0 && workflowSpan) {
            // The first root span is the workflow span we created in the collector
            // Its children are the step/conditional spans that need to be created
            const workflowSpanData = collectedRootSpans[0];
            for (const childData of workflowSpanData?.children ?? []) {
              createRealSpansFromCollected(childData, workflowSpan, result.steps);
            }
          }

          // End the workflow span with appropriate status
          if (result.status === 'failed') {
            workflowSpan?.error({
              error: result.error instanceof Error ? result.error : new Error(String(result.error)),
              attributes: { status: 'failed' },
            });
            throw new NonRetriableError(`Workflow failed`, {
              cause: result,
            });
          } else {
            workflowSpan?.end({
              output: result.status === 'success' ? result.result : undefined,
              attributes: { status: result.status },
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
