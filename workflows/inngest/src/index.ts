import { randomUUID } from 'crypto';
import { ReadableStream, WritableStream } from 'node:stream/web';
import { subscribe } from '@inngest/realtime';
import type { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import type { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import type { TracingContext, TracingOptions } from '@mastra/core/observability';
import type { WorkflowRun, WorkflowRuns } from '@mastra/core/storage';
import { ChunkFrom, WorkflowRunOutput } from '@mastra/core/stream';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { Tool, ToolStream } from '@mastra/core/tools';
import {
  getStepResult,
  Workflow,
  Run,
  DefaultExecutionEngine,
  validateStepInput,
  createDeprecationProxy,
  runCountDeprecationMessage,
  validateStepResumeData,
  createTimeTravelExecutionParams,
} from '@mastra/core/workflows';
import type {
  ExecuteFunction,
  ExecutionContext,
  ExecutionEngine,
  ExecutionGraph,
  Step,
  WorkflowConfig,
  StepFlowEntry,
  StepResult,
  WorkflowResult,
  SerializedStepFlowEntry,
  StepFailure,
  Emitter,
  StreamEvent,
  ChunkType,
  ExecutionEngineOptions,
  StepWithComponent,
  SuspendOptions,
  WorkflowStreamEvent,
  AgentStepOptions,
  WorkflowEngineType,
  TimeTravelExecutionParams,
  TimeTravelContext,
  StepParams,
  ToolStep,
} from '@mastra/core/workflows';
import { EMITTER_SYMBOL, STREAM_FORMAT_SYMBOL } from '@mastra/core/workflows/_constants';
import { NonRetriableError, RetryAfterError } from 'inngest';
import type { Inngest, BaseContext, InngestFunction, RegisterOptions } from 'inngest';
import { serve as inngestServe } from 'inngest/hono';
import { z } from 'zod';

// Extract Inngest's native flow control configuration types
type InngestCreateFunctionConfig = Parameters<Inngest['createFunction']>[0];

// Extract specific flow control properties (excluding batching)
export type InngestFlowControlConfig = Pick<
  InngestCreateFunctionConfig,
  'concurrency' | 'rateLimit' | 'throttle' | 'debounce' | 'priority'
>;

// Union type for Inngest workflows with flow control
export type InngestWorkflowConfig<
  TWorkflowId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[] = Step<string, any, any, any, any, any>[],
> = WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps> & InngestFlowControlConfig;

// Compile-time compatibility assertion
type _AssertInngestCompatibility =
  InngestFlowControlConfig extends Pick<Parameters<Inngest['createFunction']>[0], keyof InngestFlowControlConfig>
    ? true
    : never;
const _compatibilityCheck: _AssertInngestCompatibility = true;

export type InngestEngineType = {
  step: any;
};

export function serve({
  mastra,
  inngest,
  functions: userFunctions = [],
  registerOptions,
}: {
  mastra: Mastra;
  inngest: Inngest;
  /**
   * Optional array of additional functions to serve and register with Inngest.
   */
  functions?: InngestFunction.Like[];
  registerOptions?: RegisterOptions;
}): ReturnType<typeof inngestServe> {
  const wfs = mastra.listWorkflows();
  const workflowFunctions = Array.from(
    new Set(
      Object.values(wfs).flatMap(wf => {
        if (wf instanceof InngestWorkflow) {
          wf.__registerMastra(mastra);
          return wf.getFunctions();
        }
        return [];
      }),
    ),
  );

  return inngestServe({
    ...registerOptions,
    client: inngest,
    functions: [...workflowFunctions, ...userFunctions],
  });
}

export class InngestRun<
  TEngineType = InngestEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
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
        return {
          output: { result: { steps: snapshot?.context, status: 'failed', error: runs?.[0]?.output?.message } },
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
      },
    });

    const eventId = eventOutput.ids[0];
    if (!eventId) {
      throw new Error('Event ID is not set');
    }
    const runOutput = await this.getRunOutput(eventId);
    const result = runOutput?.output?.result;
    if (result.status === 'failed') {
      result.error = new Error(result.error);
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
      },
    });

    const eventId = eventOutput.ids[0];
    if (!eventId) {
      throw new Error('Event ID is not set');
    }
    const runOutput = await this.getRunOutput(eventId);
    const result = runOutput?.output?.result;
    if (result.status === 'failed') {
      result.error = new Error(result.error);
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
      },
    });

    const eventId = eventOutput.ids[0];
    if (!eventId) {
      throw new Error('Event ID is not set');
    }
    const runOutput = await this.getRunOutput(eventId);
    const result = runOutput?.output?.result;
    if (result.status === 'failed') {
      result.error = new Error(result.error);
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
    const unwatch = this.watch(async event => {
      try {
        await writer.write({
          // @ts-ignore
          type: 'start',
          // @ts-ignore
          payload: { runId: this.runId },
        });

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
            await controller.close();
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

    const workflowSnapshotInStorage = await this.getWorkflowRunExecutionResult(runIdToUse, false);

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

        const emitter = {
          emit: async (event: string, data: any) => {
            if (!publish) {
              return;
            }

            try {
              await publish({
                channel: `workflow:${this.id}:${runId}`,
                topic: event,
                data,
              });
            } catch (err: any) {
              this.logger.error('Error emitting event: ' + (err?.stack ?? err?.message ?? err));
            }
          },
          on: (_event: string, _callback: (data: any) => void) => {
            // no-op
          },
          off: (_event: string, _callback: (data: any) => void) => {
            // no-op
          },
          once: (_event: string, _callback: (data: any) => void) => {
            // no-op
          },
        };

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
          emitter,
          retryConfig: this.retryConfig,
          requestContext: new RequestContext(), // TODO
          resume,
          timeTravel,
          format,
          abortController: new AbortController(),
          // currentSpan: undefined, // TODO: Pass actual parent Span from workflow execution context
          outputOptions,
          writableStream: new WritableStream<WorkflowStreamEvent>({
            write(chunk) {
              void emitter.emit('watch', chunk).catch(() => {});
            },
          }),
        });

        // Final step to check workflow status and throw NonRetriableError if failed
        // This is needed to ensure that the Inngest workflow run is marked as failed instead of success
        await step.run(`workflow.${this.id}.finalize`, async () => {
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

function isAgent(params: any): params is Agent<any, any> {
  return params?.component === 'AGENT';
}

function isTool(params: any): params is Tool<any, any, any> {
  return params instanceof Tool;
}

export function createStep<
  TStepId extends string,
  TState extends z.ZodObject<any>,
  TStepInput extends z.ZodType<any>,
  TStepOutput extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(
  params: StepParams<TStepId, TState, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema>,
): Step<TStepId, TState, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, InngestEngineType>;

export function createStep<
  TStepId extends string,
  TStepInput extends z.ZodObject<{ prompt: z.ZodString }>,
  TStepOutput extends z.ZodObject<{ text: z.ZodString }>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(
  agent: Agent<TStepId, any>,
  agentOptions?: AgentStepOptions,
): Step<TStepId, any, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, InngestEngineType>;

export function createStep<
  TSchemaIn extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
  TContext extends ToolExecutionContext<TSuspendSchema, TResumeSchema>,
>(
  tool: ToolStep<TSchemaIn, TSuspendSchema, TResumeSchema, TSchemaOut, TContext>,
): Step<string, any, TSchemaIn, TSchemaOut, z.ZodType<any>, z.ZodType<any>, InngestEngineType>;
export function createStep<
  TStepId extends string,
  TState extends z.ZodObject<any>,
  TStepInput extends z.ZodType<any>,
  TStepOutput extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(
  params:
    | StepParams<TStepId, TState, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema>
    | Agent<any, any>
    | ToolStep<TStepInput, TSuspendSchema, TResumeSchema, TStepOutput, any>,
  agentOptions?: AgentStepOptions,
): Step<TStepId, TState, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, InngestEngineType> {
  if (isAgent(params)) {
    return {
      id: params.name,
      description: params.getDescription(),
      inputSchema: z.object({
        prompt: z.string(),
        // resourceId: z.string().optional(),
        // threadId: z.string().optional(),
      }) as unknown as TStepInput,
      outputSchema: z.object({
        text: z.string(),
      }) as unknown as TStepOutput,
      execute: async ({
        inputData,
        [EMITTER_SYMBOL]: emitter,
        [STREAM_FORMAT_SYMBOL]: streamFormat,
        requestContext,
        tracingContext,
        abortSignal,
        abort,
        writer,
      }) => {
        let streamPromise = {} as {
          promise: Promise<string>;
          resolve: (value: string) => void;
          reject: (reason?: any) => void;
        };

        streamPromise.promise = new Promise((resolve, reject) => {
          streamPromise.resolve = resolve;
          streamPromise.reject = reject;
        });
        const toolData = {
          name: params.name,
          args: inputData,
        };

        let stream: ReadableStream<any>;

        if ((await params.getModel()).specificationVersion === 'v1') {
          const { fullStream } = await params.streamLegacy(inputData.prompt, {
            ...(agentOptions ?? {}),
            // resourceId: inputData.resourceId,
            // threadId: inputData.threadId,
            requestContext,
            tracingContext,
            onFinish: result => {
              streamPromise.resolve(result.text);
              void agentOptions?.onFinish?.(result);
            },
            abortSignal,
          });
          stream = fullStream as any;
        } else {
          const modelOutput = await params.stream(inputData.prompt, {
            ...(agentOptions ?? {}),
            requestContext,
            tracingContext,
            onFinish: result => {
              streamPromise.resolve(result.text);
              void agentOptions?.onFinish?.(result);
            },
            abortSignal,
          });

          stream = modelOutput.fullStream;
        }

        if (streamFormat === 'legacy') {
          await emitter.emit('watch', {
            type: 'tool-call-streaming-start',
            ...(toolData ?? {}),
          });
          for await (const chunk of stream) {
            if (chunk.type === 'text-delta') {
              await emitter.emit('watch', {
                type: 'tool-call-delta',
                ...(toolData ?? {}),
                argsTextDelta: chunk.textDelta,
              });
            }
          }
          await emitter.emit('watch', {
            type: 'tool-call-streaming-finish',
            ...(toolData ?? {}),
          });
        } else {
          for await (const chunk of stream) {
            await writer.write(chunk as any);
          }
        }

        if (abortSignal.aborted) {
          return abort();
        }

        return {
          text: await streamPromise.promise,
        };
      },
      component: params.component,
    };
  }

  if (isTool(params)) {
    if (!params.inputSchema || !params.outputSchema) {
      throw new Error('Tool must have input and output schemas defined');
    }

    return {
      // TODO: tool probably should have strong id type
      id: params.id as unknown as TStepId,
      description: params.description,
      inputSchema: params.inputSchema,
      outputSchema: params.outputSchema,
      execute: async ({
        inputData,
        mastra,
        requestContext,
        tracingContext,
        suspend,
        resumeData,
        runId,
        workflowId,
        state,
        setState,
      }) => {
        // BREAKING CHANGE v1.0: Pass raw input as first arg, context as second
        const toolContext = {
          mastra,
          requestContext,
          tracingContext,
          resumeData,
          workflow: {
            runId,
            suspend,
            workflowId,
            state,
            setState,
          },
        };
        return params.execute(inputData, toolContext);
      },
      component: 'TOOL',
    };
  }

  return {
    id: params.id as TStepId,
    description: params.description,
    inputSchema: params.inputSchema,
    outputSchema: params.outputSchema,
    resumeSchema: params.resumeSchema,
    suspendSchema: params.suspendSchema,
    execute: params.execute,
  };
}

export function init(inngest: Inngest) {
  return {
    createWorkflow<
      TWorkflowId extends string = string,
      TState extends z.ZodObject<any> = z.ZodObject<any>,
      TInput extends z.ZodType<any> = z.ZodType<any>,
      TOutput extends z.ZodType<any> = z.ZodType<any>,
      TSteps extends Step<string, any, any, any, any, any, InngestEngineType>[] = Step<
        string,
        any,
        any,
        any,
        any,
        any,
        InngestEngineType
      >[],
    >(params: InngestWorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>) {
      return new InngestWorkflow<InngestEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TInput>(
        params,
        inngest,
      );
    },
    createStep,
    cloneStep<TStepId extends string>(
      step: Step<TStepId, any, any, any, any, any, InngestEngineType>,
      opts: { id: TStepId },
    ): Step<TStepId, any, any, any, any, any, InngestEngineType> {
      return {
        id: opts.id,
        description: step.description,
        inputSchema: step.inputSchema,
        outputSchema: step.outputSchema,
        resumeSchema: step.resumeSchema,
        suspendSchema: step.suspendSchema,
        stateSchema: step.stateSchema,
        execute: step.execute,
        retries: step.retries,
        scorers: step.scorers,
        component: step.component,
      };
    },
    cloneWorkflow<
      TWorkflowId extends string = string,
      TState extends z.ZodObject<any> = z.ZodObject<any>,
      TInput extends z.ZodType<any> = z.ZodType<any>,
      TOutput extends z.ZodType<any> = z.ZodType<any>,
      TSteps extends Step<string, any, any, any, any, any, InngestEngineType>[] = Step<
        string,
        any,
        any,
        any,
        any,
        any,
        InngestEngineType
      >[],
      TPrevSchema extends z.ZodType<any> = TInput,
    >(
      workflow: Workflow<InngestEngineType, TSteps, string, TState, TInput, TOutput, TPrevSchema>,
      opts: { id: TWorkflowId },
    ): Workflow<InngestEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> {
      const wf: Workflow<InngestEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> = new Workflow({
        id: opts.id,
        inputSchema: workflow.inputSchema,
        outputSchema: workflow.outputSchema,
        steps: workflow.stepDefs,
        mastra: workflow.mastra,
      });

      wf.setStepFlow(workflow.stepGraph);
      wf.commit();
      return wf;
    },
  };
}

export class InngestExecutionEngine extends DefaultExecutionEngine {
  private inngestStep: BaseContext<Inngest>['step'];
  private inngestAttempts: number;

  constructor(
    mastra: Mastra,
    inngestStep: BaseContext<Inngest>['step'],
    inngestAttempts: number = 0,
    options: ExecutionEngineOptions,
  ) {
    super({ mastra, options });
    this.inngestStep = inngestStep;
    this.inngestAttempts = inngestAttempts;
  }

  protected async fmtReturnValue<TOutput>(
    emitter: Emitter,
    stepResults: Record<string, StepResult<any, any, any, any>>,
    lastOutput: StepResult<any, any, any, any>,
    error?: Error | string,
  ): Promise<TOutput> {
    const base: any = {
      status: lastOutput.status,
      steps: stepResults,
    };
    if (lastOutput.status === 'success') {
      base.result = lastOutput.output;
    } else if (lastOutput.status === 'failed') {
      base.error =
        error instanceof Error
          ? (error?.stack ?? error.message)
          : lastOutput?.error instanceof Error
            ? lastOutput.error.message
            : (lastOutput.error ?? error ?? 'Unknown error');
    } else if (lastOutput.status === 'suspended') {
      const suspendedStepIds = Object.entries(stepResults).flatMap(([stepId, stepResult]) => {
        if (stepResult?.status === 'suspended') {
          const nestedPath = stepResult?.suspendPayload?.__workflow_meta?.path;
          return nestedPath ? [[stepId, ...nestedPath]] : [[stepId]];
        }

        return [];
      });
      base.suspended = suspendedStepIds;
    }

    return base as TOutput;
  }

  // async executeSleep({ id, duration }: { id: string; duration: number }): Promise<void> {
  //   await this.inngestStep.sleep(id, duration);
  // }

  async executeSleep({
    workflowId,
    runId,
    entry,
    prevOutput,
    stepResults,
    emitter,
    abortController,
    requestContext,
    executionContext,
    writableStream,
    tracingContext,
  }: {
    workflowId: string;
    runId: string;
    serializedStepGraph: SerializedStepFlowEntry[];
    entry: {
      type: 'sleep';
      id: string;
      duration?: number;
      fn?: ExecuteFunction<any, any, any, any, any, InngestEngineType>;
    };
    prevStep: StepFlowEntry;
    prevOutput: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: Emitter;
    abortController: AbortController;
    requestContext: RequestContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
  }): Promise<void> {
    let { duration, fn } = entry;

    const sleepSpan = tracingContext?.currentSpan?.createChildSpan({
      type: SpanType.WORKFLOW_SLEEP,
      name: `sleep: ${duration ? `${duration}ms` : 'dynamic'}`,
      attributes: {
        durationMs: duration,
        sleepType: fn ? 'dynamic' : 'fixed',
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    if (fn) {
      const stepCallId = randomUUID();
      duration = await this.inngestStep.run(`workflow.${workflowId}.sleep.${entry.id}`, async () => {
        return await fn(
          createDeprecationProxy(
            {
              runId,
              workflowId,
              mastra: this.mastra!,
              requestContext,
              inputData: prevOutput,
              state: executionContext.state,
              setState: (state: any) => {
                executionContext.state = state;
              },
              retryCount: -1,
              tracingContext: {
                currentSpan: sleepSpan,
              },
              getInitData: () => stepResults?.input as any,
              getStepResult: getStepResult.bind(this, stepResults),
              // TODO: this function shouldn't have suspend probably?
              suspend: async (_suspendPayload: any): Promise<any> => {},
              bail: () => {},
              abort: () => {
                abortController?.abort();
              },
              [EMITTER_SYMBOL]: emitter,
              [STREAM_FORMAT_SYMBOL]: executionContext.format,
              engine: { step: this.inngestStep },
              abortSignal: abortController?.signal,
              writer: new ToolStream(
                {
                  prefix: 'workflow-step',
                  callId: stepCallId,
                  name: 'sleep',
                  runId,
                },
                writableStream,
              ),
            },
            {
              paramName: 'runCount',
              deprecationMessage: runCountDeprecationMessage,
              logger: this.logger,
            },
          ),
        );
      });

      // Update sleep span with dynamic duration
      sleepSpan?.update({
        attributes: {
          durationMs: duration,
        },
      });
    }

    try {
      await this.inngestStep.sleep(entry.id, !duration || duration < 0 ? 0 : duration);
      sleepSpan?.end();
    } catch (e) {
      sleepSpan?.error({ error: e as Error });
      throw e;
    }
  }

  async executeSleepUntil({
    workflowId,
    runId,
    entry,
    prevOutput,
    stepResults,
    emitter,
    abortController,
    requestContext,
    executionContext,
    writableStream,
    tracingContext,
  }: {
    workflowId: string;
    runId: string;
    serializedStepGraph: SerializedStepFlowEntry[];
    entry: {
      type: 'sleepUntil';
      id: string;
      date?: Date;
      fn?: ExecuteFunction<any, any, any, any, any, InngestEngineType>;
    };
    prevStep: StepFlowEntry;
    prevOutput: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: Emitter;
    abortController: AbortController;
    requestContext: RequestContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
  }): Promise<void> {
    let { date, fn } = entry;

    const sleepUntilSpan = tracingContext?.currentSpan?.createChildSpan({
      type: SpanType.WORKFLOW_SLEEP,
      name: `sleepUntil: ${date ? date.toISOString() : 'dynamic'}`,
      attributes: {
        untilDate: date,
        durationMs: date ? Math.max(0, date.getTime() - Date.now()) : undefined,
        sleepType: fn ? 'dynamic' : 'fixed',
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    if (fn) {
      date = await this.inngestStep.run(`workflow.${workflowId}.sleepUntil.${entry.id}`, async () => {
        const stepCallId = randomUUID();
        return await fn(
          createDeprecationProxy(
            {
              runId,
              workflowId,
              mastra: this.mastra!,
              requestContext,
              inputData: prevOutput,
              state: executionContext.state,
              setState: (state: any) => {
                executionContext.state = state;
              },
              retryCount: -1,
              tracingContext: {
                currentSpan: sleepUntilSpan,
              },
              getInitData: () => stepResults?.input as any,
              getStepResult: getStepResult.bind(this, stepResults),
              // TODO: this function shouldn't have suspend probably?
              suspend: async (_suspendPayload: any): Promise<any> => {},
              bail: () => {},
              abort: () => {
                abortController?.abort();
              },
              [EMITTER_SYMBOL]: emitter,
              [STREAM_FORMAT_SYMBOL]: executionContext.format,
              engine: { step: this.inngestStep },
              abortSignal: abortController?.signal,
              writer: new ToolStream(
                {
                  prefix: 'workflow-step',
                  callId: stepCallId,
                  name: 'sleep',
                  runId,
                },
                writableStream,
              ),
            },
            {
              paramName: 'runCount',
              deprecationMessage: runCountDeprecationMessage,
              logger: this.logger,
            },
          ),
        );
      });

      // Update sleep until span with dynamic duration
      // Ensure date is a Date object before calling getTime()
      if (date && !(date instanceof Date)) {
        date = new Date(date);
      }
      const time = !date ? 0 : date.getTime() - Date.now();
      sleepUntilSpan?.update({
        attributes: {
          durationMs: Math.max(0, time),
        },
      });
    }

    if (!(date instanceof Date)) {
      sleepUntilSpan?.end();
      return;
    }

    try {
      await this.inngestStep.sleepUntil(entry.id, date);
      sleepUntilSpan?.end();
    } catch (e) {
      sleepUntilSpan?.error({ error: e as Error });
      throw e;
    }
  }

  async executeStep({
    step,
    stepResults,
    executionContext,
    resume,
    timeTravel,
    prevOutput,
    emitter,
    abortController,
    requestContext,
    tracingContext,
    writableStream,
    disableScorers,
  }: {
    step: Step<string, any, any>;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    executionContext: ExecutionContext;
    resume?: {
      steps: string[];
      resumePayload: any;
      runId?: string;
    };
    timeTravel?: TimeTravelExecutionParams;
    prevOutput: any;
    emitter: Emitter;
    abortController: AbortController;
    requestContext: RequestContext;
    tracingContext?: TracingContext;
    writableStream?: WritableStream<ChunkType>;
    disableScorers?: boolean;
  }): Promise<StepResult<any, any, any, any>> {
    const stepSpan = tracingContext?.currentSpan?.createChildSpan({
      name: `workflow step: '${step.id}'`,
      type: SpanType.WORKFLOW_STEP,
      input: prevOutput,
      attributes: {
        stepId: step.id,
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    const { inputData, validationError } = await validateStepInput({
      prevOutput,
      step,
      validateInputs: this.options?.validateInputs ?? true,
    });

    const startedAt = await this.inngestStep.run(
      `workflow.${executionContext.workflowId}.run.${executionContext.runId}.step.${step.id}.running_ev`,
      async () => {
        const startedAt = Date.now();
        await emitter.emit('watch', {
          type: 'workflow-step-start',
          payload: {
            id: step.id,
            status: 'running',
            payload: inputData,
            startedAt,
          },
        });

        return startedAt;
      },
    );

    if (step instanceof InngestWorkflow) {
      const isResume = !!resume?.steps?.length;
      let result: WorkflowResult<any, any, any, any>;
      let runId: string;

      const isTimeTravel = !!(timeTravel && timeTravel.steps?.length > 1 && timeTravel.steps[0] === step.id);

      try {
        if (isResume) {
          runId = stepResults[resume?.steps?.[0] ?? '']?.suspendPayload?.__workflow_meta?.runId ?? randomUUID();
          const snapshot: any = await this.mastra?.getStorage()?.loadWorkflowSnapshot({
            workflowName: step.id,
            runId: runId,
          });

          const invokeResp = (await this.inngestStep.invoke(`workflow.${executionContext.workflowId}.step.${step.id}`, {
            function: step.getFunction(),
            data: {
              inputData,
              initialState: executionContext.state ?? snapshot?.value ?? {},
              runId: runId,
              resume: {
                runId: runId,
                steps: resume.steps.slice(1),
                stepResults: snapshot?.context as any,
                resumePayload: resume.resumePayload,
                resumePath: resume.steps?.[1] ? (snapshot?.suspendedPaths?.[resume.steps?.[1]] as any) : undefined,
              },
              outputOptions: { includeState: true },
            },
          })) as any;
          result = invokeResp.result;
          runId = invokeResp.runId;
          executionContext.state = invokeResp.result.state;
        } else if (isTimeTravel) {
          const snapshot: any = (await this.mastra?.getStorage()?.loadWorkflowSnapshot({
            workflowName: step.id,
            runId: executionContext.runId,
          })) ?? { context: {} };
          const timeTravelParams = createTimeTravelExecutionParams({
            steps: timeTravel.steps.slice(1),
            inputData: timeTravel.inputData,
            resumeData: timeTravel.resumeData,
            context: (timeTravel.nestedStepResults?.[step.id] ?? {}) as any,
            nestedStepsContext: (timeTravel.nestedStepResults ?? {}) as any,
            snapshot,
            graph: step.buildExecutionGraph(),
          });
          const invokeResp = (await this.inngestStep.invoke(`workflow.${executionContext.workflowId}.step.${step.id}`, {
            function: step.getFunction(),
            data: {
              timeTravel: timeTravelParams,
              initialState: executionContext.state ?? {},
              runId: executionContext.runId,
              outputOptions: { includeState: true },
            },
          })) as any;
          result = invokeResp.result;
          runId = invokeResp.runId;
          executionContext.state = invokeResp.result.state;
        } else {
          const invokeResp = (await this.inngestStep.invoke(`workflow.${executionContext.workflowId}.step.${step.id}`, {
            function: step.getFunction(),
            data: {
              inputData,
              initialState: executionContext.state ?? {},
              outputOptions: { includeState: true },
            },
          })) as any;
          result = invokeResp.result;
          runId = invokeResp.runId;
          executionContext.state = invokeResp.result.state;
        }
      } catch (e) {
        // Nested workflow threw an error (likely from finalization step)
        // The error cause should contain the workflow result with runId
        const errorCause = (e as any)?.cause;

        // Try to extract runId from error cause or generate new one
        if (errorCause && typeof errorCause === 'object') {
          result = errorCause as WorkflowResult<any, any, any, any>;
          // The runId might be in the result's steps metadata
          runId = errorCause.runId || randomUUID();
        } else {
          // Fallback: if we can't get the result from error, construct a basic failed result
          runId = randomUUID();
          result = {
            status: 'failed',
            error: e instanceof Error ? e : new Error(String(e)),
            steps: {},
            input: inputData,
          } as WorkflowResult<any, any, any, any>;
        }
      }

      const res = await this.inngestStep.run(
        `workflow.${executionContext.workflowId}.step.${step.id}.nestedwf-results`,
        async () => {
          if (result.status === 'failed') {
            await emitter.emit('watch', {
              type: 'workflow-step-result',
              payload: {
                id: step.id,
                status: 'failed',
                error: result?.error,
                payload: prevOutput,
              },
            });

            return { executionContext, result: { status: 'failed', error: result?.error } };
          } else if (result.status === 'suspended') {
            const suspendedSteps = Object.entries(result.steps).filter(([_stepName, stepResult]) => {
              const stepRes: StepResult<any, any, any, any> = stepResult as StepResult<any, any, any, any>;
              return stepRes?.status === 'suspended';
            });

            for (const [stepName, stepResult] of suspendedSteps) {
              const suspendPath: string[] = [stepName, ...(stepResult?.suspendPayload?.__workflow_meta?.path ?? [])];
              executionContext.suspendedPaths[step.id] = executionContext.executionPath;

              await emitter.emit('watch', {
                type: 'workflow-step-suspended',
                payload: {
                  id: step.id,
                  status: 'suspended',
                },
              });

              return {
                executionContext,
                result: {
                  status: 'suspended',
                  payload: stepResult.payload,
                  suspendPayload: {
                    ...(stepResult as any)?.suspendPayload,
                    __workflow_meta: { runId: runId, path: suspendPath },
                  },
                },
              };
            }

            return {
              executionContext,
              result: {
                status: 'suspended',
                payload: {},
              },
            };
          }

          await emitter.emit('watch', {
            type: 'workflow-step-result',
            payload: {
              id: step.id,
              status: 'success',
              output: result?.result,
            },
          });

          await emitter.emit('watch', {
            type: 'workflow-step-finish',
            payload: {
              id: step.id,
              metadata: {},
            },
          });

          return { executionContext, result: { status: 'success', output: result?.result } };
        },
      );

      Object.assign(executionContext, res.executionContext);
      return {
        ...res.result,
        startedAt,
        endedAt: Date.now(),
        payload: inputData,
        resumedAt: resume?.steps[0] === step.id ? startedAt : undefined,
        resumePayload: resume?.steps[0] === step.id ? resume?.resumePayload : undefined,
      } as StepResult<any, any, any, any>;
    }

    const stepCallId = randomUUID();
    let stepRes: {
      result: {
        status: 'success' | 'failed' | 'suspended' | 'bailed';
        output?: any;
        startedAt: number;
        endedAt?: number;
        payload: any;
        error?: string;
        resumedAt?: number;
        resumePayload?: any;
        suspendPayload?: any;
        suspendedAt?: number;
      };
      stepResults: Record<
        string,
        StepResult<any, any, any, any> | (Omit<StepFailure<any, any, any, any>, 'error'> & { error?: string })
      >;
      executionContext: ExecutionContext;
    };

    try {
      stepRes = await this.inngestStep.run(`workflow.${executionContext.workflowId}.step.${step.id}`, async () => {
        let execResults: {
          status: 'success' | 'failed' | 'suspended' | 'bailed';
          output?: any;
          startedAt: number;
          endedAt?: number;
          payload: any;
          error?: string;
          resumedAt?: number;
          resumePayload?: any;
          suspendPayload?: any;
          suspendedAt?: number;
        };
        let suspended: { payload: any } | undefined;
        let bailed: { payload: any } | undefined;

        const { resumeData: timeTravelResumeData, validationError: timeTravelResumeValidationError } =
          await validateStepResumeData({
            resumeData: timeTravel?.stepResults[step.id]?.status === 'suspended' ? timeTravel?.resumeData : undefined,
            step,
          });

        let resumeDataToUse;
        if (timeTravelResumeData && !timeTravelResumeValidationError) {
          resumeDataToUse = timeTravelResumeData;
        } else if (timeTravelResumeData && timeTravelResumeValidationError) {
          this.logger.warn('Time travel resume data validation failed', {
            stepId: step.id,
            error: timeTravelResumeValidationError.message,
          });
        } else if (resume?.steps[0] === step.id) {
          resumeDataToUse = resume?.resumePayload;
        }

        try {
          if (validationError) {
            throw validationError;
          }

          const retryCount = this.getOrGenerateRetryCount(step.id);

          const result = await step.execute({
            runId: executionContext.runId,
            workflowId: executionContext.workflowId,
            mastra: this.mastra!,
            requestContext,
            retryCount,
            writer: new ToolStream(
              {
                prefix: 'workflow-step',
                callId: stepCallId,
                name: step.id,
                runId: executionContext.runId,
              },
              writableStream,
            ),
            state: executionContext?.state ?? {},
            setState: (state: any) => {
              executionContext.state = state;
            },
            inputData,
            resumeData: resumeDataToUse,
            tracingContext: {
              currentSpan: stepSpan,
            },
            getInitData: () => stepResults?.input as any,
            getStepResult: getStepResult.bind(this, stepResults),
            suspend: async (suspendPayload: any, suspendOptions?: SuspendOptions) => {
              executionContext.suspendedPaths[step.id] = executionContext.executionPath;
              if (suspendOptions?.resumeLabel) {
                const resumeLabel = Array.isArray(suspendOptions.resumeLabel)
                  ? suspendOptions.resumeLabel
                  : [suspendOptions.resumeLabel];
                for (const label of resumeLabel) {
                  executionContext.resumeLabels[label] = {
                    stepId: step.id,
                    foreachIndex: executionContext.foreachIndex,
                  };
                }
              }
              suspended = { payload: suspendPayload };
            },
            bail: (result: any) => {
              bailed = { payload: result };
            },
            abort: () => {
              abortController?.abort();
            },
            [EMITTER_SYMBOL]: emitter,
            [STREAM_FORMAT_SYMBOL]: executionContext.format,
            engine: {
              step: this.inngestStep,
            },
            abortSignal: abortController.signal,
          });
          const endedAt = Date.now();

          execResults = {
            status: 'success',
            output: result,
            startedAt,
            endedAt,
            payload: inputData,
            resumedAt: resumeDataToUse ? startedAt : undefined,
            resumePayload: resumeDataToUse,
          };
        } catch (e) {
          const stepFailure: Omit<StepFailure<any, any, any, any>, 'error'> & { error?: string } = {
            status: 'failed',
            payload: inputData,
            error: e instanceof Error ? e.message : String(e),
            endedAt: Date.now(),
            startedAt,
            resumedAt: resumeDataToUse ? startedAt : undefined,
            resumePayload: resumeDataToUse,
          };

          execResults = stepFailure;

          const fallbackErrorMessage = `Step ${step.id} failed`;
          stepSpan?.error({ error: new Error(execResults.error ?? fallbackErrorMessage) });
          throw new RetryAfterError(execResults.error ?? fallbackErrorMessage, executionContext.retryConfig.delay, {
            cause: execResults,
          });
        }

        if (suspended) {
          execResults = {
            status: 'suspended',
            suspendPayload: suspended.payload,
            ...(execResults.output ? { suspendOutput: execResults.output } : {}),
            payload: inputData,
            suspendedAt: Date.now(),
            startedAt,
            resumedAt: resumeDataToUse ? startedAt : undefined,
            resumePayload: resumeDataToUse,
          };
        } else if (bailed) {
          execResults = {
            status: 'bailed',
            output: bailed.payload,
            payload: inputData,
            endedAt: Date.now(),
            startedAt,
          };
        }

        if (execResults.status === 'suspended') {
          await emitter.emit('watch', {
            type: 'workflow-step-suspended',
            payload: {
              id: step.id,
              ...execResults,
            },
          });
        } else {
          await emitter.emit('watch', {
            type: 'workflow-step-result',
            payload: {
              id: step.id,
              ...execResults,
            },
          });

          await emitter.emit('watch', {
            type: 'workflow-step-finish',
            payload: {
              id: step.id,
              metadata: {},
            },
          });
        }

        stepSpan?.end({ output: execResults });

        return { result: execResults, executionContext, stepResults };
      });
    } catch (e) {
      const stepFailure: Omit<StepFailure<any, any, any, any>, 'error'> & { error?: string } =
        e instanceof Error
          ? (e?.cause as unknown as Omit<StepFailure<any, any, any, any>, 'error'> & { error?: string })
          : {
              status: 'failed' as const,
              error: e instanceof Error ? e.message : String(e),
              payload: inputData,
              startedAt,
              endedAt: Date.now(),
            };

      stepRes = {
        result: stepFailure,
        executionContext,
        stepResults: {
          ...stepResults,
          [step.id]: stepFailure,
        },
      };
    }

    if (disableScorers !== false && stepRes.result.status === 'success') {
      await this.inngestStep.run(`workflow.${executionContext.workflowId}.step.${step.id}.score`, async () => {
        if (step.scorers) {
          await this.runScorers({
            scorers: step.scorers,
            runId: executionContext.runId,
            input: inputData,
            output: stepRes.result,
            workflowId: executionContext.workflowId,
            stepId: step.id,
            requestContext,
            disableScorers,
            tracingContext: { currentSpan: stepSpan },
          });
        }
      });
    }

    Object.assign(executionContext.suspendedPaths, stepRes.executionContext.suspendedPaths);
    executionContext.state = stepRes.executionContext.state;

    return stepRes.result as StepResult<any, any, any, any>;
  }

  async persistStepUpdate({
    workflowId,
    runId,
    stepResults,
    resourceId,
    executionContext,
    serializedStepGraph,
    workflowStatus,
    result,
    error,
  }: {
    workflowId: string;
    runId: string;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    serializedStepGraph: SerializedStepFlowEntry[];
    resourceId?: string;
    executionContext: ExecutionContext;
    workflowStatus: 'success' | 'failed' | 'suspended' | 'running';
    result?: Record<string, any>;
    error?: string | Error;
    requestContext: RequestContext;
  }) {
    await this.inngestStep.run(
      `workflow.${workflowId}.run.${runId}.path.${JSON.stringify(executionContext.executionPath)}.stepUpdate`,
      async () => {
        const shouldPersistSnapshot = this.options.shouldPersistSnapshot({ stepResults, workflowStatus });

        if (!shouldPersistSnapshot) {
          return;
        }

        await this.mastra?.getStorage()?.persistWorkflowSnapshot({
          workflowName: workflowId,
          runId,
          resourceId,
          snapshot: {
            runId,
            status: workflowStatus,
            value: executionContext.state,
            context: stepResults as any,
            activePaths: executionContext.executionPath,
            activeStepsPath: executionContext.activeStepsPath,
            suspendedPaths: executionContext.suspendedPaths,
            resumeLabels: executionContext.resumeLabels,
            waitingPaths: {},
            serializedStepGraph,
            result,
            error,
            timestamp: Date.now(),
          },
        });
      },
    );
  }

  async executeConditional({
    workflowId,
    runId,
    entry,
    prevOutput,
    stepResults,
    timeTravel,
    resume,
    executionContext,
    emitter,
    abortController,
    requestContext,
    writableStream,
    disableScorers,
    tracingContext,
  }: {
    workflowId: string;
    runId: string;
    entry: {
      type: 'conditional';
      steps: { type: 'step'; step: Step<string, any, any> }[];
      conditions: ExecuteFunction<any, any, any, any, any, InngestEngineType>[];
    };
    serializedStepGraph: SerializedStepFlowEntry[];
    prevOutput: any;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    timeTravel?: TimeTravelExecutionParams;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
    };
    executionContext: ExecutionContext;
    emitter: Emitter;
    abortController: AbortController;
    requestContext: RequestContext;
    writableStream?: WritableStream<ChunkType>;
    disableScorers?: boolean;
    tracingContext?: TracingContext;
  }): Promise<StepResult<any, any, any, any>> {
    const conditionalSpan = tracingContext?.currentSpan?.createChildSpan({
      type: SpanType.WORKFLOW_CONDITIONAL,
      name: `conditional: '${entry.conditions.length} conditions'`,
      input: prevOutput,
      attributes: {
        conditionCount: entry.conditions.length,
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    let execResults: any;
    const truthyIndexes = (
      await Promise.all(
        entry.conditions.map((cond, index) =>
          this.inngestStep.run(`workflow.${workflowId}.conditional.${index}`, async () => {
            const evalSpan = conditionalSpan?.createChildSpan({
              type: SpanType.WORKFLOW_CONDITIONAL_EVAL,
              name: `condition: '${index}'`,
              input: prevOutput,
              attributes: {
                conditionIndex: index,
              },
              tracingPolicy: this.options?.tracingPolicy,
            });

            try {
              const result = await cond(
                createDeprecationProxy(
                  {
                    runId,
                    workflowId,
                    mastra: this.mastra!,
                    requestContext,
                    retryCount: -1,
                    inputData: prevOutput,
                    state: executionContext.state,
                    setState: (state: any) => {
                      executionContext.state = state;
                    },
                    tracingContext: {
                      currentSpan: evalSpan,
                    },
                    getInitData: () => stepResults?.input as any,
                    getStepResult: getStepResult.bind(this, stepResults),
                    // TODO: this function shouldn't have suspend probably?
                    suspend: async (_suspendPayload: any) => {},
                    bail: () => {},
                    abort: () => {
                      abortController.abort();
                    },
                    [EMITTER_SYMBOL]: emitter,
                    [STREAM_FORMAT_SYMBOL]: executionContext.format,
                    engine: {
                      step: this.inngestStep,
                    },
                    abortSignal: abortController.signal,
                    writer: new ToolStream(
                      {
                        prefix: 'workflow-step',
                        callId: randomUUID(),
                        name: 'conditional',
                        runId,
                      },
                      writableStream,
                    ),
                  },
                  {
                    paramName: 'runCount',
                    deprecationMessage: runCountDeprecationMessage,
                    logger: this.logger,
                  },
                ),
              );

              evalSpan?.end({
                output: result,
                attributes: {
                  result: !!result,
                },
              });

              return result ? index : null;
            } catch (e: unknown) {
              evalSpan?.error({
                error: e instanceof Error ? e : new Error(String(e)),
                attributes: {
                  result: false,
                },
              });

              return null;
            }
          }),
        ),
      )
    ).filter((index: any): index is number => index !== null);

    const stepsToRun = entry.steps.filter((_, index) => truthyIndexes.includes(index));

    // Update conditional span with evaluation results
    conditionalSpan?.update({
      attributes: {
        truthyIndexes,
        selectedSteps: stepsToRun.map(s => (s.type === 'step' ? s.step.id : `control-${s.type}`)),
      },
    });

    const results: StepResult<any, any, any, any>[] = await Promise.all(
      stepsToRun.map(async (step, index) => {
        const currStepResult = stepResults[step.step.id];
        if (currStepResult && currStepResult.status === 'success') {
          return currStepResult;
        }
        const result = await this.executeStep({
          step: step.step,
          prevOutput,
          stepResults,
          resume,
          timeTravel,
          executionContext: {
            workflowId,
            runId,
            executionPath: [...executionContext.executionPath, index],
            activeStepsPath: executionContext.activeStepsPath,
            suspendedPaths: executionContext.suspendedPaths,
            resumeLabels: executionContext.resumeLabels,
            retryConfig: executionContext.retryConfig,
            state: executionContext.state,
          },
          emitter,
          abortController,
          requestContext,
          writableStream,
          disableScorers,
          tracingContext: {
            currentSpan: conditionalSpan,
          },
        });

        stepResults[step.step.id] = result;
        return result;
      }),
    );
    const hasFailed = results.find(result => result.status === 'failed') as StepFailure<any, any, any, any>;
    const hasSuspended = results.find(result => result.status === 'suspended');
    if (hasFailed) {
      execResults = { status: 'failed', error: hasFailed.error };
    } else if (hasSuspended) {
      execResults = {
        status: 'suspended',
        suspendPayload: hasSuspended.suspendPayload,
        ...(hasSuspended.suspendOutput ? { suspendOutput: hasSuspended.suspendOutput } : {}),
      };
    } else {
      execResults = {
        status: 'success',
        output: results.reduce((acc: Record<string, any>, result, index) => {
          if (result.status === 'success') {
            if ('step' in stepsToRun[index]!) {
              acc[stepsToRun[index]!.step.id] = result.output;
            }
          }

          return acc;
        }, {}),
      };
    }

    if (execResults.status === 'failed') {
      conditionalSpan?.error({
        error: new Error(execResults.error),
      });
    } else {
      conditionalSpan?.end({
        output: execResults.output || execResults,
      });
    }

    return execResults;
  }
}
