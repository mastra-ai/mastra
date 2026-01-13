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
import type { z } from 'zod';
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
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TPrevSchema extends z.ZodType<any> = TInput,
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

    const existingRun = await this.getWorkflowRunById(runIdToUse, {
      withNestedWorkflows: false,
    });

    // Check if run exists in persistent storage (not just in-memory)
    const existsInStorage = existingRun && !existingRun.isFromInMemory;

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
        const requestContext = new RequestContext<Record<string, any>>(Object.entries(event.data.requestContext ?? {}));

        // Store mastra reference for use in proxy closure
        const mastra = this.#mastra;
        const tracingPolicy = this.options.tracingPolicy;
        console.log('[INNGEST TRACING DEBUG] Handler start - mastra:', !!mastra, 'tracingPolicy:', !!tracingPolicy);

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

        // Create a proxy span that delegates createChildSpan to getOrCreateSpan with parentSpanId.
        // This allows child spans to be created with correct parent linkage even though
        // the actual workflow span doesn't exist yet (it's created in finalize).
        // The proxy implements the minimal interface needed by workflow handlers.
        // Note: end/error/update are no-ops here - the actual span lifecycle is managed in finalize.
        const proxyWorkflowSpan = {
          id: spanMeta.spanId,
          traceId: spanMeta.traceId,
          createChildSpan: (childOptions: Record<string, any>) => {
            // Delegate to getOrCreateSpan which supports creating spans by parentSpanId
            return getOrCreateSpan({
              ...childOptions,
              tracingPolicy,
              tracingOptions: {
                traceId: spanMeta.traceId,
                parentSpanId: spanMeta.spanId, // Link to the workflow span by ID
              },
              requestContext,
              mastra,
            } as any);
          },
          // No-op methods - actual span lifecycle is managed in finalize step
          end: () => {},
          error: () => {},
          update: () => {},
        };

        const engine = new InngestExecutionEngine(this.#mastra, step, attempt, this.options);

        let result: WorkflowResult<TState, TInput, TOutput, TSteps>;
        try {
          result = await engine.execute<
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
        // This is also where we create the actual workflow span with memoized IDs.
        // The span is created once here (finalize is memoized by step.run).
        await step.run(`workflow.${this.id}.finalize`, async () => {
          console.log('[INNGEST TRACING DEBUG] Finalize step running');
          console.log('[INNGEST TRACING DEBUG] mastra defined:', !!mastra);
          console.log('[INNGEST TRACING DEBUG] mastra.observability:', !!mastra?.observability);

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

          // Create the actual workflow span with memoized IDs.
          // Child spans created during execution already reference this span via parentSpanId.
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

          console.log('[INNGEST TRACING DEBUG] workflowSpan created:', !!workflowSpan);
          console.log('[INNGEST TRACING DEBUG] workflowSpan type:', typeof workflowSpan);
          console.log('[INNGEST TRACING DEBUG] workflowSpan constructor:', workflowSpan?.constructor?.name);
          console.log('[INNGEST TRACING DEBUG] workflowSpan.end type:', typeof workflowSpan?.end);
          console.log('[INNGEST TRACING DEBUG] workflowSpan keys:', workflowSpan ? Object.keys(workflowSpan) : 'N/A');

          // Set the start time to when the workflow actually started
          if (workflowSpan && 'startTime' in workflowSpan) {
            (workflowSpan as any).startTime = new Date(spanMeta.startTime);
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
