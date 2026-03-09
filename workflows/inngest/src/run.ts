import { ReadableStream } from 'node:stream/web';
import { subscribe } from '@inngest/realtime';
import { getErrorFromUnknown } from '@mastra/core/error';
import type { Mastra } from '@mastra/core/mastra';
import type { TracingContext, TracingOptions } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';
import { WorkflowRunOutput, ChunkFrom } from '@mastra/core/stream';
import { createTimeTravelExecutionParams, Run, hydrateSerializedStepErrors } from '@mastra/core/workflows';
import type {
  ExecutionEngine,
  ExecutionGraph,
  OutputWriter,
  SerializedStepFlowEntry,
  Step,
  StepWithComponent,
  StreamEvent,
  TimeTravelContext,
  WorkflowEngineType,
  WorkflowResult,
  WorkflowStreamEvent,
} from '@mastra/core/workflows';
import { NonRetriableError } from 'inngest';
import type { Inngest } from 'inngest';
import type { InngestEngineType } from './types';

export class InngestRun<
  TEngineType = InngestEngineType,
  TSteps extends Step<string, any, any, any, any, any, TEngineType>[] = Step<
    string,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    TEngineType
  >[],
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
> extends Run<TEngineType, TSteps, TState, TInput, TOutput> {
  private inngest: Inngest;
  serializedStepGraph: SerializedStepFlowEntry[];
  #mastra: Mastra;

  constructor(
    params: {
      workflowId: string;
      runId: string;
      resourceId?: string;
      executionEngine: ExecutionEngine;
      executionGraph: ExecutionGraph;
      serializedStepGraph: SerializedStepFlowEntry[];
      mastra?: Mastra;
      retryConfig?: {
        attempts?: number;
        delay?: number;
      };
      cleanup?: () => void;
      workflowSteps: Record<string, StepWithComponent>;
      workflowEngineType: WorkflowEngineType;
      validateInputs?: boolean;
    },
    inngest: Inngest,
  ) {
    super(params);
    this.inngest = inngest;
    this.serializedStepGraph = params.serializedStepGraph;
    this.#mastra = params.mastra!;
  }

  async getRuns(eventId: string) {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(
          `${this.inngest.apiBaseUrl ?? 'https://api.inngest.com'}/v1/events/${eventId}/runs`,
          {
            headers: {
              Authorization: `Bearer ${process.env.INNGEST_SIGNING_KEY}`,
            },
          },
        );

        // Handle rate limiting with retry
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '2', 10);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        // Non-OK responses
        if (!response.ok) {
          throw new Error(`Inngest API error: ${response.status} ${response.statusText}`);
        }

        // Parse JSON safely
        const text = await response.text();
        if (!text) {
          // Empty response - eventual consistency, retry with backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }

        const json = JSON.parse(text);
        return json.data;
      } catch (error) {
        lastError = error as Error;
        // Exponential backoff before retry
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    // After all retries, throw NonRetriableError to prevent Inngest function-level retry
    throw new NonRetriableError(`Failed to get runs after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Get run output using hybrid approach: realtime subscription + polling fallback.
   * Resolves as soon as either method detects completion.
   */
  async getRunOutput(eventId: string, maxWaitMs = 300000) {
    const storage = this.#mastra?.getStorage();
    const workflowsStore = await storage?.getStore('workflows');

    return new Promise<any>((resolve, reject) => {
      let resolved = false;
      let unsubscribe: (() => void) | null = null;
      let pollTimeoutId: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (unsubscribe) {
          try {
            unsubscribe();
          } catch {
            // Ignore unsubscribe errors
          }
        }
        if (pollTimeoutId) {
          clearTimeout(pollTimeoutId);
        }
      };

      const handleResult = (result: any, _source: string) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(result);
        }
      };

      const handleError = (error: any, _source: string) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(error);
        }
      };

      // Start realtime subscription for workflow-finish event
      let realtimeStreamPromise: ReturnType<typeof subscribe> | null = null;

      const startRealtimeSubscription = async () => {
        try {
          realtimeStreamPromise = subscribe(
            {
              channel: `workflow:${this.workflowId}:${this.runId}`,
              topics: ['watch'],
              app: this.inngest,
            },
            async (message: any) => {
              if (resolved) return;

              const event = message.data;

              if (event?.type === 'workflow-finish') {
                // Got the finish event - load snapshot and resolve
                const snapshot = await workflowsStore?.loadWorkflowSnapshot({
                  workflowName: this.workflowId,
                  runId: this.runId,
                });
                if (snapshot?.context) {
                  snapshot.context = hydrateSerializedStepErrors(snapshot.context);
                }

                const result = {
                  output: {
                    result: {
                      steps: snapshot?.context,
                      status: event.payload.status,
                      result: event.payload.result,
                      error: event.payload.error
                        ? getErrorFromUnknown(event.payload.error, { serializeStack: false })
                        : undefined,
                    },
                  },
                };

                handleResult(result, 'realtime');
              }
            },
          );

          // Set unsubscribe immediately so cleanup can cancel even before await resolves
          unsubscribe = () => {
            realtimeStreamPromise?.then(stream => stream.cancel().catch(() => {})).catch(() => {});
          };

          await realtimeStreamPromise;
        } catch {
          // Realtime subscription failed - polling will still work as fallback
        }
      };

      // Start polling as fallback
      const startPolling = async () => {
        const startTime = Date.now();

        const poll = async () => {
          if (resolved) {
            return;
          }
          if (Date.now() - startTime >= maxWaitMs) {
            handleError(new NonRetriableError(`Workflow did not complete within ${maxWaitMs}ms`), 'polling-timeout');
            return;
          }

          try {
            const runs = await this.getRuns(eventId);
            const run = runs?.find((r: { event_id: string }) => r.event_id === eventId);

            if (run?.status === 'Completed') {
              const snapshot = await workflowsStore?.loadWorkflowSnapshot({
                workflowName: this.workflowId,
                runId: this.runId,
              });
              if (snapshot?.context) {
                snapshot.context = hydrateSerializedStepErrors(snapshot.context);
              }
              handleResult({ output: { result: { steps: snapshot?.context, status: 'success' } } }, 'polling');
              return;
            }

            if (run?.status === 'Failed') {
              const snapshot = await workflowsStore?.loadWorkflowSnapshot({
                workflowName: this.workflowId,
                runId: this.runId,
              });
              if (snapshot?.context) {
                snapshot.context = hydrateSerializedStepErrors(snapshot.context);
              }
              handleResult(
                {
                  output: {
                    result: {
                      steps: snapshot?.context,
                      status: 'failed',
                      error: getErrorFromUnknown(run?.output?.cause?.error, { serializeStack: false }),
                    },
                  },
                },
                'polling-failed',
              );
              return;
            }

            if (run?.status === 'Cancelled') {
              const snapshot = await workflowsStore?.loadWorkflowSnapshot({
                workflowName: this.workflowId,
                runId: this.runId,
              });
              if (snapshot?.context) {
                snapshot.context = hydrateSerializedStepErrors(snapshot.context);
              }
              handleResult(
                { output: { result: { steps: snapshot?.context, status: 'canceled' } } },
                'polling-cancelled',
              );
              return;
            }

            // Schedule next poll with jitter
            pollTimeoutId = setTimeout(poll, 200 + Math.random() * 200);
          } catch (error) {
            if (error instanceof NonRetriableError) {
              handleError(error, 'polling-non-retriable');
              return;
            }
            handleError(
              new NonRetriableError(
                `Failed to poll workflow status: ${error instanceof Error ? error.message : String(error)}`,
              ),
              'polling-error',
            );
          }
        };

        // Start first poll
        void poll();
      };

      // Start both in parallel
      void startRealtimeSubscription();
      void startPolling();
    });
  }

  async cancel() {
    const storage = this.#mastra?.getStorage();

    await this.inngest.send({
      name: `cancel.workflow.${this.workflowId}`,
      data: {
        runId: this.runId,
      },
    });

    const workflowsStore = await storage?.getStore('workflows');
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });
    if (snapshot) {
      await workflowsStore?.persistWorkflowSnapshot({
        workflowName: this.workflowId,
        runId: this.runId,
        resourceId: this.resourceId,
        snapshot: {
          ...snapshot,
          status: 'canceled' as any,
          value: snapshot.value,
        },
      });
    }
  }

  async start(
    args: (TInput extends unknown
      ? {
          inputData?: TInput;
        }
      : {
          inputData: TInput;
        }) &
      (TState extends unknown
        ? {
            initialState?: TState;
          }
        : {
            initialState: TState;
          }) & {
        requestContext?: RequestContext;
        outputWriter?: OutputWriter;
        tracingContext?: TracingContext;
        tracingOptions?: TracingOptions;
        outputOptions?: {
          includeState?: boolean;
          includeResumeLabels?: boolean;
        };
        perStep?: boolean;
      },
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    return this._start(args);
  }

  /**
   * Starts the workflow execution without waiting for completion (fire-and-forget).
   * Returns immediately with the runId after sending the event to Inngest.
   * The workflow executes independently in Inngest.
   * Use this when you don't need to wait for the result or want to avoid polling failures.
   */
  async startAsync(
    args: (TInput extends unknown
      ? {
          inputData?: TInput;
        }
      : {
          inputData: TInput;
        }) &
      (TState extends unknown
        ? {
            initialState?: TState;
          }
        : {
            initialState: TState;
          }) & {
        requestContext?: RequestContext;
        tracingOptions?: TracingOptions;
        outputOptions?: {
          includeState?: boolean;
          includeResumeLabels?: boolean;
        };
        perStep?: boolean;
      },
  ): Promise<{ runId: string }> {
    // Persist initial snapshot
    const workflowsStore = await this.#mastra.getStorage()?.getStore('workflows');
    await workflowsStore?.persistWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      snapshot: {
        runId: this.runId,
        serializedStepGraph: this.serializedStepGraph,
        status: 'running',
        value: {},
        context: {} as any,
        activePaths: [],
        suspendedPaths: {},
        activeStepsPath: {},
        resumeLabels: {},
        waitingPaths: {},
        timestamp: Date.now(),
      },
    });

    // Validate inputs
    const inputDataToUse = await this._validateInput(args.inputData);
    const initialStateToUse = await this._validateInitialState(args.initialState ?? ({} as TState));

    // Send event to Inngest (fire-and-forget)
    const eventOutput = await this.inngest.send({
      name: `workflow.${this.workflowId}`,
      data: {
        inputData: inputDataToUse,
        initialState: initialStateToUse,
        runId: this.runId,
        resourceId: this.resourceId,
        outputOptions: args.outputOptions,
        tracingOptions: args.tracingOptions,
        requestContext: args.requestContext ? Object.fromEntries(args.requestContext.entries()) : {},
        perStep: args.perStep,
      },
    });

    const eventId = eventOutput.ids[0];
    if (!eventId) {
      throw new Error('Event ID is not set');
    }

    // Return immediately - NO POLLING
    return { runId: this.runId };
  }

  async _start({
    inputData,
    initialState,
    outputOptions,
    tracingOptions,
    format,
    requestContext,
    perStep,
  }: {
    inputData?: TInput;
    requestContext?: RequestContext;
    initialState?: TState;
    tracingOptions?: TracingOptions;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    format?: 'legacy' | 'vnext' | undefined;
    perStep?: boolean;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const workflowsStore = await this.#mastra.getStorage()?.getStore('workflows');
    await workflowsStore?.persistWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      snapshot: {
        runId: this.runId,
        serializedStepGraph: this.serializedStepGraph,
        status: 'running',
        value: {},
        context: {} as any,
        activePaths: [],
        suspendedPaths: {},
        activeStepsPath: {},
        resumeLabels: {},
        waitingPaths: {},
        timestamp: Date.now(),
      },
    });

    const inputDataToUse = await this._validateInput(inputData);
    const initialStateToUse = await this._validateInitialState(initialState ?? ({} as TState));

    const eventName = `workflow.${this.workflowId}`;

    const eventOutput = await this.inngest.send({
      name: eventName,
      data: {
        inputData: inputDataToUse,
        initialState: initialStateToUse,
        runId: this.runId,
        resourceId: this.resourceId,
        outputOptions,
        tracingOptions,
        format,
        requestContext: requestContext ? Object.fromEntries(requestContext.entries()) : {},
        perStep,
      },
    });

    const eventId = eventOutput.ids[0];
    if (!eventId) {
      throw new Error('Event ID is not set');
    }

    const runOutput = await this.getRunOutput(eventId);
    const result = runOutput?.output?.result;

    this.hydrateFailedResult(result);

    if (result.status !== 'suspended') {
      this.cleanup?.();
    }
    return result;
  }

  async resume<TResume>(params: {
    resumeData?: TResume;
    step?:
      | Step<string, any, any, TResume, any>
      | [...Step<string, any, any, any, any>[], Step<string, any, any, TResume, any>]
      | string
      | string[];
    label?: string;
    requestContext?: RequestContext;
    perStep?: boolean;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const p = this._resume(params).then(result => {
      if (result.status !== 'suspended') {
        this.closeStreamAction?.().catch(() => {});
      }

      return result;
    });

    this.executionResults = p;
    return p;
  }

  async _resume<TResume>(params: {
    resumeData?: TResume;
    step?:
      | Step<string, any, any, TResume, any>
      | [...Step<string, any, any, any, any>[], Step<string, any, any, TResume, any>]
      | string
      | string[];
    label?: string;
    requestContext?: RequestContext;
    perStep?: boolean;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const storage = this.#mastra?.getStorage();

    const workflowsStore = await storage?.getStore('workflows');
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    // Support label-based resume: look up step from resumeLabels
    const snapshotResumeLabel = params.label ? snapshot?.resumeLabels?.[params.label] : undefined;
    const stepParam = snapshotResumeLabel?.stepId ?? params.step;

    let steps: string[] = [];
    if (stepParam) {
      if (typeof stepParam === 'string') {
        steps = stepParam.split('.');
      } else {
        steps = (Array.isArray(stepParam) ? stepParam : [stepParam]).map(step =>
          typeof step === 'string' ? step : step?.id,
        );
      }
    }

    const suspendedStep = this.workflowSteps[steps?.[0] ?? ''];

    const resumeDataToUse = await this._validateResumeData(params.resumeData, suspendedStep);

    // Merge persisted requestContext from snapshot with any new values from params
    const persistedRequestContext = (snapshot as any)?.requestContext ?? {};
    const newRequestContext = params.requestContext ? Object.fromEntries(params.requestContext.entries()) : {};
    const mergedRequestContext = { ...persistedRequestContext, ...newRequestContext };

    const eventOutput = await this.inngest.send({
      name: `workflow.${this.workflowId}`,
      data: {
        inputData: resumeDataToUse,
        initialState: snapshot?.value ?? {},
        runId: this.runId,
        workflowId: this.workflowId,
        stepResults: snapshot?.context as any,
        resume: {
          steps,
          stepResults: snapshot?.context as any,
          resumePayload: resumeDataToUse,
          resumePath: steps?.[0] ? (snapshot?.suspendedPaths?.[steps?.[0]] as any) : undefined,
        },
        requestContext: mergedRequestContext,
        perStep: params.perStep,
      },
    });

    const eventId = eventOutput.ids[0];
    if (!eventId) {
      throw new Error('Event ID is not set');
    }
    const runOutput = await this.getRunOutput(eventId);
    const result = runOutput?.output?.result;
    this.hydrateFailedResult(result);
    return result;
  }

  async timeTravel<TInput>(params: {
    inputData?: TInput;
    resumeData?: any;
    initialState?: TState;
    step:
      | Step<string, any, TInput, any, any>
      | [...Step<string, any, any, any, any>[], Step<string, any, TInput, any, any>]
      | string
      | string[];
    context?: TimeTravelContext<any, any, any, any>;
    nestedStepsContext?: Record<string, TimeTravelContext<any, any, any, any>>;
    requestContext?: RequestContext;
    tracingOptions?: TracingOptions;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    perStep?: boolean;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const p = this._timeTravel(params).then(result => {
      if (result.status !== 'suspended') {
        this.closeStreamAction?.().catch(() => {});
      }

      return result;
    });

    this.executionResults = p;
    return p;
  }

  async _timeTravel<TInput>(params: {
    inputData?: TInput;
    resumeData?: any;
    initialState?: TState;
    step:
      | Step<string, any, TInput, any, any>
      | [...Step<string, any, any, any, any>[], Step<string, any, TInput, any, any>]
      | string
      | string[];
    context?: TimeTravelContext<any, any, any, any>;
    nestedStepsContext?: Record<string, TimeTravelContext<any, any, any, any>>;
    requestContext?: RequestContext;
    tracingOptions?: TracingOptions;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    perStep?: boolean;
  }) {
    if (!params.step || (Array.isArray(params.step) && params.step?.length === 0)) {
      throw new Error('Step is required and must be a valid step or array of steps');
    }

    let steps: string[] = [];
    if (typeof params.step === 'string') {
      steps = params.step.split('.');
    } else {
      steps = (Array.isArray(params.step) ? params.step : [params.step]).map(step =>
        typeof step === 'string' ? step : step?.id,
      );
    }

    if (steps.length === 0) {
      throw new Error('No steps provided to timeTravel');
    }

    const storage = this.#mastra?.getStorage();
    const workflowsStore = await storage?.getStore('workflows');

    const snapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    if (!snapshot) {
      await workflowsStore?.persistWorkflowSnapshot({
        workflowName: this.workflowId,
        runId: this.runId,
        resourceId: this.resourceId,
        snapshot: {
          runId: this.runId,
          serializedStepGraph: this.serializedStepGraph,
          status: 'pending',
          value: {},
          context: {} as any,
          activePaths: [],
          suspendedPaths: {},
          activeStepsPath: {},
          resumeLabels: {},
          waitingPaths: {},
          timestamp: Date.now(),
        },
      });
    }

    if (snapshot?.status === 'running') {
      throw new Error('This workflow run is still running, cannot time travel');
    }

    let inputDataToUse = params.inputData;

    if (inputDataToUse && steps.length === 1) {
      inputDataToUse = await this._validateTimetravelInputData(params.inputData, this.workflowSteps[steps[0]!]!);
    }

    const timeTravelData = createTimeTravelExecutionParams({
      steps,
      inputData: inputDataToUse,
      resumeData: params.resumeData,
      context: params.context,
      nestedStepsContext: params.nestedStepsContext,
      snapshot: (snapshot ?? { context: {} }) as any,
      graph: this.executionGraph,
      initialState: params.initialState,
      perStep: params.perStep,
    });

    const eventOutput = await this.inngest.send({
      name: `workflow.${this.workflowId}`,
      data: {
        initialState: timeTravelData.state,
        runId: this.runId,
        workflowId: this.workflowId,
        stepResults: timeTravelData.stepResults,
        timeTravel: timeTravelData,
        tracingOptions: params.tracingOptions,
        outputOptions: params.outputOptions,
        requestContext: params.requestContext ? Object.fromEntries(params.requestContext.entries()) : {},
        perStep: params.perStep,
      },
    });

    const eventId = eventOutput.ids[0];
    if (!eventId) {
      throw new Error('Event ID is not set');
    }
    const runOutput = await this.getRunOutput(eventId);
    const result = runOutput?.output?.result;
    this.hydrateFailedResult(result);
    return result;
  }

  watch(cb: (event: WorkflowStreamEvent) => void): () => void {
    let active = true;
    const streamPromise = subscribe(
      {
        channel: `workflow:${this.workflowId}:${this.runId}`,
        topics: ['watch'],
        app: this.inngest,
      },
      (message: any) => {
        if (active) {
          cb(message.data);
        }
      },
    );

    return () => {
      active = false;
      streamPromise
        .then(async (stream: Awaited<typeof streamPromise>) => {
          return stream.cancel();
        })
        .catch(err => {
          console.error(err);
        });
    };
  }

  streamLegacy({ inputData, requestContext }: { inputData?: TInput; requestContext?: RequestContext } = {}): {
    stream: ReadableStream<StreamEvent>;
    getWorkflowState: () => Promise<WorkflowResult<TState, TInput, TOutput, TSteps>>;
  } {
    const { readable, writable } = new TransformStream<StreamEvent, StreamEvent>();

    const writer = writable.getWriter();
    void writer.write({
      // @ts-expect-error - stream event type mismatch
      type: 'start',
      payload: { runId: this.runId },
    });

    const unwatch = this.watch(async event => {
      try {
        const e: any = {
          ...event,
          type: event.type.replace('workflow-', ''),
        };

        if (e.type === 'step-output') {
          e.type = e.payload.output.type;
          e.payload = e.payload.output.payload;
        }
        // watch events are data stream events, so we need to cast them to the correct type
        await writer.write(e as any);
      } catch {}
    });

    this.closeStreamAction = async () => {
      await writer.write({
        type: 'finish',
        // @ts-expect-error - stream event type mismatch
        payload: { runId: this.runId },
      });
      unwatch();

      try {
        await writer.close();
      } catch (err) {
        console.error('Error closing stream:', err);
      } finally {
        writer.releaseLock();
      }
    };

    this.executionResults = this._start({ inputData, requestContext, format: 'legacy' }).then(result => {
      if (result.status !== 'suspended') {
        this.closeStreamAction?.().catch(() => {});
      }

      return result;
    });

    return {
      stream: readable as ReadableStream<StreamEvent>,
      getWorkflowState: () => this.executionResults!,
    };
  }

  stream({
    inputData,
    requestContext,
    tracingOptions,
    closeOnSuspend = true,
    initialState,
    outputOptions,
    perStep,
  }: {
    inputData?: TInput;
    requestContext?: RequestContext;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    closeOnSuspend?: boolean;
    initialState?: TState;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    perStep?: boolean;
  } = {}): WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    if (this.closeStreamAction && this.streamOutput) {
      return this.streamOutput;
    }

    this.closeStreamAction = async () => {};

    const self = this;
    const stream = new ReadableStream<WorkflowStreamEvent>({
      async start(controller) {
        // TODO: fix this, watch doesn't have a type
        const unwatch = self.watch(async ({ type, from = ChunkFrom.WORKFLOW, payload }) => {
          controller.enqueue({
            type,
            runId: self.runId,
            from,
            payload: {
              stepName: (payload as unknown as { id: string })?.id,
              ...payload,
            },
          } as WorkflowStreamEvent);
        });

        self.closeStreamAction = async () => {
          unwatch();

          try {
            await controller.close();
          } catch (err) {
            console.error('Error closing stream:', err);
          }
        };

        const executionResultsPromise = self._start({
          inputData,
          requestContext,
          // tracingContext, // We are not able to pass a reference to a span here, what to do?
          initialState,
          tracingOptions,
          outputOptions,
          format: 'vnext',
          perStep,
        });
        let executionResults;
        try {
          executionResults = await executionResultsPromise;

          if (closeOnSuspend) {
            // always close stream, even if the workflow is suspended
            // this will trigger a finish event with workflow status set to suspended
            self.closeStreamAction?.().catch(() => {});
          } else if (executionResults.status !== 'suspended') {
            self.closeStreamAction?.().catch(() => {});
          }
          if (self.streamOutput) {
            self.streamOutput.updateResults(
              executionResults as unknown as WorkflowResult<TState, TInput, TOutput, TSteps>,
            );
          }
        } catch (err) {
          self.streamOutput?.rejectResults(err as unknown as Error);
          self.closeStreamAction?.().catch(() => {});
        }
      },
    });

    this.streamOutput = new WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>>({
      runId: this.runId,
      workflowId: this.workflowId,
      stream,
    });

    return this.streamOutput;
  }

  timeTravelStream<TTravelInput>({
    inputData,
    resumeData,
    initialState,
    step,
    context,
    nestedStepsContext,
    requestContext,
    // tracingContext,
    tracingOptions,
    outputOptions,
    perStep,
  }: {
    inputData?: TTravelInput;
    initialState?: TState;
    resumeData?: any;
    step:
      | Step<string, any, any, any, any, any, TEngineType>
      | [...Step<string, any, any, any, any, any, TEngineType>[], Step<string, any, any, any, any, any, TEngineType>]
      | string
      | string[];
    context?: TimeTravelContext<any, any, any, any>;
    nestedStepsContext?: Record<string, TimeTravelContext<any, any, any, any>>;
    requestContext?: RequestContext;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    perStep?: boolean;
  }) {
    this.closeStreamAction = async () => {};

    const self = this;
    const stream = new ReadableStream<WorkflowStreamEvent>({
      async start(controller) {
        // TODO: fix this, watch doesn't have a type
        const unwatch = self.watch(async ({ type, from = ChunkFrom.WORKFLOW, payload }) => {
          controller.enqueue({
            type,
            runId: self.runId,
            from,
            payload: {
              stepName: (payload as unknown as { id: string })?.id,
              ...payload,
            },
          } as WorkflowStreamEvent);
        });

        self.closeStreamAction = async () => {
          unwatch();

          try {
            controller.close();
          } catch (err) {
            console.error('Error closing stream:', err);
          }
        };
        const executionResultsPromise = self._timeTravel({
          inputData,
          step,
          context,
          nestedStepsContext,
          resumeData,
          initialState,
          requestContext,
          tracingOptions,
          outputOptions,
          perStep,
        });

        self.executionResults = executionResultsPromise;

        let executionResults;
        try {
          executionResults = await executionResultsPromise;
          self.closeStreamAction?.().catch(() => {});

          if (self.streamOutput) {
            self.streamOutput.updateResults(executionResults);
          }
        } catch (err) {
          self.streamOutput?.rejectResults(err as unknown as Error);
          self.closeStreamAction?.().catch(() => {});
        }
      },
    });

    this.streamOutput = new WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>>({
      runId: this.runId,
      workflowId: this.workflowId,
      stream,
    });

    return this.streamOutput;
  }

  /**
   * Hydrates errors in a failed workflow result back to proper Error instances.
   * This ensures error.cause chains and custom properties are preserved.
   */
  private hydrateFailedResult(result: WorkflowResult<TState, TInput, TOutput, TSteps>): void {
    if (result.status === 'failed') {
      // Ensure error is a proper Error instance with all properties preserved
      result.error = getErrorFromUnknown(result.error, { serializeStack: false });
      // Re-hydrate serialized errors in step results
      if (result.steps) {
        hydrateSerializedStepErrors(result.steps);
      }
    }
  }
}
