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
  SerializedStepFlowEntry,
  Step,
  StepWithComponent,
  StreamEvent,
  TimeTravelContext,
  WorkflowEngineType,
  WorkflowResult,
  WorkflowStreamEvent,
} from '@mastra/core/workflows';
import type { Inngest } from 'inngest';
import type z from 'zod';
import type { InngestEngineType } from './types';

export class InngestRun<
  TEngineType = InngestEngineType,
  TSteps extends Step<string, any, any, any, any, any, any>[] = Step<string, any, any, any, any, any, any>[],
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
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
    const response = await fetch(`${this.inngest.apiBaseUrl ?? 'https://api.inngest.com'}/v1/events/${eventId}/runs`, {
      headers: {
        Authorization: `Bearer ${process.env.INNGEST_SIGNING_KEY}`,
      },
    });
    const json = await response.json();
    return (json as any).data;
  }

  async getRunOutput(eventId: string) {
    let runs = await this.getRuns(eventId);
    const storage = this.#mastra?.getStorage();

    while (runs?.[0]?.status !== 'Completed' || runs?.[0]?.event_id !== eventId) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runs = await this.getRuns(eventId);

      if (runs?.[0]?.status === 'Failed') {
        const snapshot = await storage?.loadWorkflowSnapshot({
          workflowName: this.workflowId,
          runId: this.runId,
        });
        // Hydrate serialized errors back to Error instances
        if (snapshot?.context) {
          snapshot.context = hydrateSerializedStepErrors(snapshot.context);
        }
        return {
          output: {
            result: {
              steps: snapshot?.context,
              status: 'failed',
              // Get the original error from NonRetriableError's cause (which contains the workflow result)
              error: getErrorFromUnknown(runs?.[0]?.output?.cause?.error, { serializeStack: false }),
            },
          },
        };
      }

      if (runs?.[0]?.status === 'Cancelled') {
        const snapshot = await storage?.loadWorkflowSnapshot({
          workflowName: this.workflowId,
          runId: this.runId,
        });
        return { output: { result: { steps: snapshot?.context, status: 'canceled' } } };
      }
    }
    return runs?.[0];
  }

  async cancel() {
    const storage = this.#mastra?.getStorage();

    await this.inngest.send({
      name: `cancel.workflow.${this.workflowId}`,
      data: {
        runId: this.runId,
      },
    });

    const snapshot = await storage?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });
    if (snapshot) {
      await storage?.persistWorkflowSnapshot({
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

  async start(params: {
    inputData?: z.infer<TInput>;
    requestContext?: RequestContext;
    initialState?: z.infer<TState>;
    tracingOptions?: TracingOptions;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    return this._start(params);
  }

  async _start({
    inputData,
    initialState,
    outputOptions,
    tracingOptions,
    format,
    requestContext,
  }: {
    inputData?: z.infer<TInput>;
    requestContext?: RequestContext;
    initialState?: z.infer<TState>;
    tracingOptions?: TracingOptions;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    format?: 'legacy' | 'vnext' | undefined;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    await this.#mastra.getStorage()?.persistWorkflowSnapshot({
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
    const initialStateToUse = await this._validateInitialState(initialState ?? {});

    const eventOutput = await this.inngest.send({
      name: `workflow.${this.workflowId}`,
      data: {
        inputData: inputDataToUse,
        initialState: initialStateToUse,
        runId: this.runId,
        resourceId: this.resourceId,
        outputOptions,
        tracingOptions,
        format,
        requestContext: requestContext ? Object.fromEntries(requestContext.entries()) : {},
      },
    });

    const eventId = eventOutput.ids[0];
    if (!eventId) {
      throw new Error('Event ID is not set');
    }
    const runOutput = await this.getRunOutput(eventId);
    const result = runOutput?.output?.result;

    if (result.status === 'failed') {
      // Ensure error is a proper Error instance with all properties preserved
      result.error = getErrorFromUnknown(result.error, { serializeStack: false });
      // Re-hydrate serialized errors in step results
      if (result.steps) {
        hydrateSerializedStepErrors(result.steps);
      }
    }

    if (result.status !== 'suspended') {
      this.cleanup?.();
    }
    return result;
  }

  async resume<TResumeSchema extends z.ZodType<any>>(params: {
    resumeData?: z.infer<TResumeSchema>;
    step:
      | Step<string, any, any, TResumeSchema, any>
      | [...Step<string, any, any, any, any>[], Step<string, any, any, TResumeSchema, any>]
      | string
      | string[];
    requestContext?: RequestContext;
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

  async _resume<TResumeSchema extends z.ZodType<any>>(params: {
    resumeData?: z.infer<TResumeSchema>;
    step:
      | Step<string, any, any, TResumeSchema, any>
      | [...Step<string, any, any, any, any>[], Step<string, any, any, TResumeSchema, any>]
      | string
      | string[];
    requestContext?: RequestContext;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const storage = this.#mastra?.getStorage();

    let steps: string[] = [];
    if (typeof params.step === 'string') {
      steps = params.step.split('.');
    } else {
      steps = (Array.isArray(params.step) ? params.step : [params.step]).map(step =>
        typeof step === 'string' ? step : step?.id,
      );
    }
    const snapshot = await storage?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

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
      },
    });

    const eventId = eventOutput.ids[0];
    if (!eventId) {
      throw new Error('Event ID is not set');
    }
    const runOutput = await this.getRunOutput(eventId);
    const result = runOutput?.output?.result;
    if (result.status === 'failed') {
      // Ensure error is a proper Error instance with all properties preserved
      result.error = getErrorFromUnknown(result.error, { serializeStack: false });
      // Re-hydrate serialized errors in step results
      if (result.steps) {
        hydrateSerializedStepErrors(result.steps);
      }
    }
    return result;
  }

  async timeTravel<TInputSchema extends z.ZodType<any>>(params: {
    inputData?: z.infer<TInputSchema>;
    resumeData?: any;
    initialState?: z.infer<TState>;
    step:
      | Step<string, any, TInputSchema, any, any>
      | [...Step<string, any, any, any, any>[], Step<string, any, TInputSchema, any, any>]
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

  async _timeTravel<TInputSchema extends z.ZodType<any>>(params: {
    inputData?: z.infer<TInputSchema>;
    resumeData?: any;
    initialState?: z.infer<TState>;
    step:
      | Step<string, any, TInputSchema, any, any>
      | [...Step<string, any, any, any, any>[], Step<string, any, TInputSchema, any, any>]
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
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
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

    const snapshot = await storage?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    if (!snapshot) {
      await storage?.persistWorkflowSnapshot({
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
      },
    });

    const eventId = eventOutput.ids[0];
    if (!eventId) {
      throw new Error('Event ID is not set');
    }
    const runOutput = await this.getRunOutput(eventId);
    const result = runOutput?.output?.result;
    if (result.status === 'failed') {
      // Ensure error is a proper Error instance with all properties preserved
      result.error = getErrorFromUnknown(result.error, { serializeStack: false });
      // Re-hydrate serialized errors in step results
      if (result.steps) {
        hydrateSerializedStepErrors(result.steps);
      }
    }
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

  streamLegacy({ inputData, requestContext }: { inputData?: z.infer<TInput>; requestContext?: RequestContext } = {}): {
    stream: ReadableStream<StreamEvent>;
    getWorkflowState: () => Promise<WorkflowResult<TState, TInput, TOutput, TSteps>>;
  } {
    const { readable, writable } = new TransformStream<StreamEvent, StreamEvent>();

    const writer = writable.getWriter();
    void writer.write({
      // @ts-ignore
      type: 'start',
      // @ts-ignore
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
        // @ts-ignore
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
  }: {
    inputData?: z.input<TInput>;
    requestContext?: RequestContext;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    closeOnSuspend?: boolean;
    initialState?: z.input<TState>;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
  } = {}): ReturnType<Run<InngestEngineType, TSteps, TState, TInput, TOutput>['stream']> {
    if (this.closeStreamAction && this.streamOutput) {
      return this.streamOutput;
    }

    this.closeStreamAction = async () => {};

    const self = this;
    const stream = new ReadableStream<WorkflowStreamEvent>({
      async start(controller) {
        // TODO: fix this, watch doesn't have a type
        // @ts-ignore
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

  streamVNext(
    args: {
      inputData?: z.input<TInput>;
      requestContext?: RequestContext;
      tracingContext?: TracingContext;
      tracingOptions?: TracingOptions;
      closeOnSuspend?: boolean;
      initialState?: z.input<TState>;
      outputOptions?: {
        includeState?: boolean;
        includeResumeLabels?: boolean;
      };
    } = {},
  ): ReturnType<Run<InngestEngineType, TSteps, TState, TInput, TOutput>['stream']> {
    return this.stream(args);
  }

  timeTravelStream<TInputSchema extends z.ZodType<any>>({
    inputData,
    resumeData,
    initialState,
    step,
    context,
    nestedStepsContext,
    requestContext,
    tracingOptions,
    outputOptions,
  }: {
    inputData?: z.input<TInputSchema>;
    initialState?: z.input<TState>;
    resumeData?: any;
    step:
      | Step<string, any, TInputSchema, any, any, any, TEngineType>
      | [
          ...Step<string, any, any, any, any, any, TEngineType>[],
          Step<string, any, TInputSchema, any, any, any, TEngineType>,
        ]
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
  }) {
    this.closeStreamAction = async () => {};

    const self = this;
    const stream = new ReadableStream<WorkflowStreamEvent>({
      async start(controller) {
        // TODO: fix this, watch doesn't have a type
        // @ts-ignore
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
}
