import { randomUUID } from 'crypto';
import type { ReadableStream } from 'node:stream/web';
import { subscribe } from '@inngest/realtime';
import type { Agent } from '@mastra/core/agent';
import { AISpanType, wrapMastra } from '@mastra/core/ai-tracing';
import type { TracingContext, AnyAISpan } from '@mastra/core/ai-tracing';
import { RuntimeContext } from '@mastra/core/di';
import type { Mastra } from '@mastra/core/mastra';
import type { WorkflowRun, WorkflowRuns } from '@mastra/core/storage';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { Tool, ToolStream } from '@mastra/core/tools';
import { Workflow, Run, DefaultExecutionEngine } from '@mastra/core/workflows';
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
  WatchEvent,
  StreamEvent,
  ChunkType,
  ExecutionEngineOptions,
} from '@mastra/core/workflows';
import { EMITTER_SYMBOL, STREAM_FORMAT_SYMBOL } from '@mastra/core/workflows/_constants';
import type { Span } from '@opentelemetry/api';
import type { Inngest, BaseContext, InngestFunction } from 'inngest';
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
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[] = Step<string, any, any, any, any, any>[],
> = WorkflowConfig<TWorkflowId, TInput, TOutput, TSteps> & InngestFlowControlConfig;

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
}: {
  mastra: Mastra;
  inngest: Inngest;
  /**
   * Optional array of additional functions to serve and register with Inngest.
   */
  functions?: InngestFunction.Like[];
}): ReturnType<typeof inngestServe> {
  const wfs = mastra.getWorkflows();
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
    client: inngest,
    functions: [...workflowFunctions, ...userFunctions],
  });
}

export class InngestRun<
  TEngineType = InngestEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
> extends Run<TEngineType, TSteps, TInput, TOutput> {
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

    while (runs?.[0]?.status !== 'Completed' || runs?.[0]?.event_id !== eventId) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runs = await this.getRuns(eventId);
      if (runs?.[0]?.status === 'Failed') {
        throw new Error(`Function run ${runs?.[0]?.status}`);
      } else if (runs?.[0]?.status === 'Cancelled') {
        const snapshot = await this.#mastra?.storage?.loadWorkflowSnapshot({
          workflowName: this.workflowId,
          runId: this.runId,
        });
        return { output: { result: { steps: snapshot?.context, status: 'canceled' } } };
      }
    }
    return runs?.[0];
  }

  async sendEvent(event: string, data: any) {
    await this.inngest.send({
      name: `user-event-${event}`,
      data,
    });
  }

  async cancel() {
    await this.inngest.send({
      name: `cancel.workflow.${this.workflowId}`,
      data: {
        runId: this.runId,
      },
    });

    const snapshot = await this.#mastra?.storage?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });
    if (snapshot) {
      await this.#mastra?.storage?.persistWorkflowSnapshot({
        workflowName: this.workflowId,
        runId: this.runId,
        resourceId: this.resourceId,
        snapshot: {
          ...snapshot,
          status: 'canceled' as any,
        },
      });
    }
  }

  async start({
    inputData,
  }: {
    inputData?: z.infer<TInput>;
    runtimeContext?: RuntimeContext;
  }): Promise<WorkflowResult<TOutput, TSteps>> {
    await this.#mastra.getStorage()?.persistWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      snapshot: {
        runId: this.runId,
        serializedStepGraph: this.serializedStepGraph,
        value: {},
        context: {} as any,
        activePaths: [],
        suspendedPaths: {},
        waitingPaths: {},
        timestamp: Date.now(),
        status: 'running',
      },
    });

    const eventOutput = await this.inngest.send({
      name: `workflow.${this.workflowId}`,
      data: {
        inputData,
        runId: this.runId,
        resourceId: this.resourceId,
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
    runtimeContext?: RuntimeContext;
  }): Promise<WorkflowResult<TOutput, TSteps>> {
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
    runtimeContext?: RuntimeContext;
  }): Promise<WorkflowResult<TOutput, TSteps>> {
    const steps: string[] = (Array.isArray(params.step) ? params.step : [params.step]).map(step =>
      typeof step === 'string' ? step : step?.id,
    );
    const snapshot = await this.#mastra?.storage?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    const eventOutput = await this.inngest.send({
      name: `workflow.${this.workflowId}`,
      data: {
        inputData: params.resumeData,
        runId: this.runId,
        workflowId: this.workflowId,
        stepResults: snapshot?.context as any,
        resume: {
          steps,
          stepResults: snapshot?.context as any,
          resumePayload: params.resumeData,
          // @ts-ignore
          resumePath: snapshot?.suspendedPaths?.[steps?.[0]] as any,
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

  watch(cb: (event: WatchEvent) => void, type: 'watch' | 'watch-v2' = 'watch'): () => void {
    let active = true;
    const streamPromise = subscribe(
      {
        channel: `workflow:${this.workflowId}:${this.runId}`,
        topics: [type],
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

  stream({ inputData, runtimeContext }: { inputData?: z.infer<TInput>; runtimeContext?: RuntimeContext } = {}): {
    stream: ReadableStream<StreamEvent>;
    getWorkflowState: () => Promise<WorkflowResult<TOutput, TSteps>>;
  } {
    const { readable, writable } = new TransformStream<StreamEvent, StreamEvent>();

    const writer = writable.getWriter();
    const unwatch = this.watch(async event => {
      try {
        const e: any = {
          ...event,
          type: event.type.replace('workflow-', ''),
        };
        // watch-v2 events are data stream events, so we need to cast them to the correct type
        await writer.write(e as any);
      } catch {}
    }, 'watch-v2');

    this.closeStreamAction = async () => {
      unwatch();

      try {
        await writer.close();
      } catch (err) {
        console.error('Error closing stream:', err);
      } finally {
        writer.releaseLock();
      }
    };

    this.executionResults = this.start({ inputData, runtimeContext }).then(result => {
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
}

export class InngestWorkflow<
  TEngineType = InngestEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TPrevSchema extends z.ZodType<any> = TInput,
> extends Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> {
  #mastra: Mastra;
  public inngest: Inngest;

  private function: ReturnType<Inngest['createFunction']> | undefined;
  private readonly flowControlConfig?: InngestFlowControlConfig;

  constructor(params: InngestWorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>, inngest: Inngest) {
    const { concurrency, rateLimit, throttle, debounce, priority, ...workflowParams } = params;

    super(workflowParams as WorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>);

    const flowControlEntries = Object.entries({ concurrency, rateLimit, throttle, debounce, priority }).filter(
      ([_, value]) => value !== undefined,
    );

    this.flowControlConfig = flowControlEntries.length > 0 ? Object.fromEntries(flowControlEntries) : undefined;

    this.#mastra = params.mastra!;
    this.inngest = inngest;
  }

  async getWorkflowRuns(args?: {
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  }) {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      this.logger.debug('Cannot get workflow runs. Mastra engine is not initialized');
      return { runs: [], total: 0 };
    }

    return storage.getWorkflowRuns({ workflowName: this.id, ...(args ?? {}) }) as unknown as WorkflowRuns;
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

  /**
   * @deprecated Use createRunAsync() instead.
   * @throws {Error} Always throws an error directing users to use createRunAsync()
   */
  createRun(_options?: { runId?: string }): Run<TEngineType, TSteps, TInput, TOutput> {
    throw new Error(
      'createRun() has been deprecated. ' +
        'Please use createRunAsync() instead.\n\n' +
        'Migration guide:\n' +
        '  Before: const run = workflow.createRun();\n' +
        '  After:  const run = await workflow.createRunAsync();\n\n' +
        'Note: createRunAsync() is an async method, so make sure your calling function is async.',
    );
  }

  async createRunAsync(options?: {
    runId?: string;
    resourceId?: string;
  }): Promise<Run<TEngineType, TSteps, TInput, TOutput>> {
    const runIdToUse = options?.runId || randomUUID();

    // Return a new Run instance with object parameters
    const run: Run<TEngineType, TSteps, TInput, TOutput> =
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
        },
        this.inngest,
      );

    this.runs.set(runIdToUse, run);

    const workflowSnapshotInStorage = await this.getWorkflowRunExecutionResult(runIdToUse, false);

    if (!workflowSnapshotInStorage) {
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
          waitingPaths: {},
          serializedStepGraph: this.serializedStepGraph,
          suspendedPaths: {},
          result: undefined,
          error: undefined,
          // @ts-ignore
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
        // @ts-ignore
        retries: this.retryConfig?.attempts ?? 0,
        cancelOn: [{ event: `cancel.workflow.${this.id}` }],
        // Spread flow control configuration
        ...this.flowControlConfig,
      },
      { event: `workflow.${this.id}` },
      async ({ event, step, attempt, publish }) => {
        let { inputData, runId, resourceId, resume } = event.data;

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

        const engine = new InngestExecutionEngine(this.#mastra, step, attempt);
        const result = await engine.execute<z.infer<TInput>, WorkflowResult<TOutput, TSteps>>({
          workflowId: this.id,
          runId,
          resourceId,
          graph: this.executionGraph,
          serializedStepGraph: this.serializedStepGraph,
          input: inputData,
          emitter,
          retryConfig: this.retryConfig,
          runtimeContext: new RuntimeContext(), // TODO
          resume,
          abortController: new AbortController(),
          currentSpan: undefined, // TODO: Pass actual parent AI span from workflow execution context
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

function isAgent(params: any): params is Agent<any, any, any> {
  return params?.component === 'AGENT';
}

function isTool(params: any): params is Tool<any, any, any> {
  return params instanceof Tool;
}

export function createStep<
  TStepId extends string,
  TStepInput extends z.ZodType<any>,
  TStepOutput extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(params: {
  id: TStepId;
  description?: string;
  inputSchema: TStepInput;
  outputSchema: TStepOutput;
  resumeSchema?: TResumeSchema;
  suspendSchema?: TSuspendSchema;
  execute: ExecuteFunction<
    z.infer<TStepInput>,
    z.infer<TStepOutput>,
    z.infer<TResumeSchema>,
    z.infer<TSuspendSchema>,
    InngestEngineType
  >;
}): Step<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, InngestEngineType>;

export function createStep<
  TStepId extends string,
  TStepInput extends z.ZodObject<{ prompt: z.ZodString }>,
  TStepOutput extends z.ZodObject<{ text: z.ZodString }>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(
  agent: Agent<TStepId, any, any>,
): Step<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, InngestEngineType>;

export function createStep<
  TSchemaIn extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
  TContext extends ToolExecutionContext<TSchemaIn>,
>(
  tool: Tool<TSchemaIn, TSchemaOut, TContext> & {
    inputSchema: TSchemaIn;
    outputSchema: TSchemaOut;
    execute: (context: TContext) => Promise<any>;
  },
): Step<string, TSchemaIn, TSchemaOut, z.ZodType<any>, z.ZodType<any>, InngestEngineType>;
export function createStep<
  TStepId extends string,
  TStepInput extends z.ZodType<any>,
  TStepOutput extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(
  params:
    | {
        id: TStepId;
        description?: string;
        inputSchema: TStepInput;
        outputSchema: TStepOutput;
        resumeSchema?: TResumeSchema;
        suspendSchema?: TSuspendSchema;
        execute: ExecuteFunction<
          z.infer<TStepInput>,
          z.infer<TStepOutput>,
          z.infer<TResumeSchema>,
          z.infer<TSuspendSchema>,
          InngestEngineType
        >;
      }
    | Agent<any, any, any>
    | (Tool<TStepInput, TStepOutput, any> & {
        inputSchema: TStepInput;
        outputSchema: TStepOutput;
        execute: (context: ToolExecutionContext<TStepInput>) => Promise<any>;
      }),
): Step<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, InngestEngineType> {
  if (isAgent(params)) {
    return {
      id: params.name,
      // @ts-ignore
      inputSchema: z.object({
        prompt: z.string(),
      }),
      // @ts-ignore
      outputSchema: z.object({
        text: z.string(),
      }),
      execute: async ({ inputData, [EMITTER_SYMBOL]: emitter, runtimeContext, abortSignal, abort, tracingContext }) => {
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

        const { fullStream } = await params.stream(inputData.prompt, {
          runtimeContext,
          tracingContext,
          onFinish: result => {
            streamPromise.resolve(result.text);
          },
          abortSignal,
        });

        if (abortSignal.aborted) {
          return abort();
        }

        await emitter.emit('watch-v2', {
          type: 'tool-call-streaming-start',
          ...(toolData ?? {}),
        });

        for await (const chunk of fullStream) {
          if (chunk.type === 'text-delta') {
            await emitter.emit('watch-v2', {
              type: 'tool-call-delta',
              ...(toolData ?? {}),
              argsTextDelta: chunk.textDelta,
            });
          }
        }

        await emitter.emit('watch-v2', {
          type: 'tool-call-streaming-finish',
          ...(toolData ?? {}),
        });

        return {
          text: await streamPromise.promise,
        };
      },
    };
  }

  if (isTool(params)) {
    if (!params.inputSchema || !params.outputSchema) {
      throw new Error('Tool must have input and output schemas defined');
    }

    return {
      // TODO: tool probably should have strong id type
      // @ts-ignore
      id: params.id,
      inputSchema: params.inputSchema,
      outputSchema: params.outputSchema,
      execute: async ({ inputData, mastra, runtimeContext, tracingContext }) => {
        return params.execute({
          context: inputData,
          mastra: wrapMastra(mastra, tracingContext),
          runtimeContext,
          tracingContext,
        });
      },
    };
  }

  return {
    id: params.id,
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
      TInput extends z.ZodType<any> = z.ZodType<any>,
      TOutput extends z.ZodType<any> = z.ZodType<any>,
      TSteps extends Step<string, any, any, any, any, InngestEngineType>[] = Step<
        string,
        any,
        any,
        any,
        any,
        InngestEngineType
      >[],
    >(params: InngestWorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>) {
      return new InngestWorkflow<InngestEngineType, TSteps, TWorkflowId, TInput, TOutput, TInput>(params, inngest);
    },
    createStep,
    cloneStep<TStepId extends string>(
      step: Step<string, any, any, any, any, InngestEngineType>,
      opts: { id: TStepId },
    ): Step<TStepId, any, any, any, any, InngestEngineType> {
      return {
        id: opts.id,
        description: step.description,
        inputSchema: step.inputSchema,
        outputSchema: step.outputSchema,
        execute: step.execute,
      };
    },
    cloneWorkflow<
      TWorkflowId extends string = string,
      TInput extends z.ZodType<any> = z.ZodType<any>,
      TOutput extends z.ZodType<any> = z.ZodType<any>,
      TSteps extends Step<string, any, any, any, any, InngestEngineType>[] = Step<
        string,
        any,
        any,
        any,
        any,
        InngestEngineType
      >[],
      TPrevSchema extends z.ZodType<any> = TInput,
    >(
      workflow: Workflow<InngestEngineType, TSteps, string, TInput, TOutput, TPrevSchema>,
      opts: { id: TWorkflowId },
    ): Workflow<InngestEngineType, TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> {
      const wf: Workflow<InngestEngineType, TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> = new Workflow({
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
    options?: ExecutionEngineOptions,
  ) {
    super({ mastra, options });
    this.inngestStep = inngestStep;
    this.inngestAttempts = inngestAttempts;
  }

  async execute<TInput, TOutput>(params: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    graph: ExecutionGraph;
    serializedStepGraph: SerializedStepFlowEntry[];
    input?: TInput;
    resume?: {
      // TODO: add execute path
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
    };
    emitter: Emitter;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    runtimeContext: RuntimeContext;
    abortController: AbortController;
    currentSpan?: AnyAISpan;
  }): Promise<TOutput> {
    await params.emitter.emit('watch-v2', {
      type: 'workflow-start',
      payload: { runId: params.runId },
    });

    const result = await super.execute<TInput, TOutput>(params);

    await params.emitter.emit('watch-v2', {
      type: 'workflow-finish',
      payload: { runId: params.runId },
    });

    return result;
  }

  protected async fmtReturnValue<TOutput>(
    executionSpan: Span | undefined,
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
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          workflowState: {
            status: lastOutput.status,
            steps: stepResults,
            result: lastOutput.output,
          },
        },
        eventTimestamp: Date.now(),
      });

      base.result = lastOutput.output;
    } else if (lastOutput.status === 'failed') {
      base.error =
        error instanceof Error
          ? (error?.stack ?? error.message)
          : lastOutput?.error instanceof Error
            ? lastOutput.error.message
            : (lastOutput.error ?? error ?? 'Unknown error');

      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          workflowState: {
            status: lastOutput.status,
            steps: stepResults,
            result: null,
            error: base.error,
          },
        },
        eventTimestamp: Date.now(),
      });
    } else if (lastOutput.status === 'suspended') {
      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          workflowState: {
            status: lastOutput.status,
            steps: stepResults,
            result: null,
            error: null,
          },
        },
        eventTimestamp: Date.now(),
      });

      const suspendedStepIds = Object.entries(stepResults).flatMap(([stepId, stepResult]) => {
        if (stepResult?.status === 'suspended') {
          const nestedPath = stepResult?.payload?.__workflow_meta?.path;
          return nestedPath ? [[stepId, ...nestedPath]] : [[stepId]];
        }

        return [];
      });
      base.suspended = suspendedStepIds;
    }

    executionSpan?.end();
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
    runtimeContext,
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
      fn?: ExecuteFunction<any, any, any, any, InngestEngineType>;
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
    runtimeContext: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
  }): Promise<void> {
    let { duration, fn } = entry;

    const sleepSpan = tracingContext?.currentSpan?.createChildSpan({
      type: AISpanType.WORKFLOW_SLEEP,
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
        return await fn({
          runId,
          workflowId,
          mastra: this.mastra!,
          runtimeContext,
          inputData: prevOutput,
          runCount: -1,
          tracingContext: {
            currentSpan: sleepSpan,
          },
          getInitData: () => stepResults?.input as any,
          getStepResult: (step: any) => {
            if (!step?.id) {
              return null;
            }

            const result = stepResults[step.id];
            if (result?.status === 'success') {
              return result.output;
            }

            return null;
          },

          // TODO: this function shouldn't have suspend probably?
          suspend: async (_suspendPayload: any): Promise<any> => {},
          bail: () => {},
          abort: () => {
            abortController?.abort();
          },
          [EMITTER_SYMBOL]: emitter,
          // TODO: add streamVNext support
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
        });
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
    runtimeContext,
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
      fn?: ExecuteFunction<any, any, any, any, InngestEngineType>;
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
    runtimeContext: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
  }): Promise<void> {
    let { date, fn } = entry;

    const sleepUntilSpan = tracingContext?.currentSpan?.createChildSpan({
      type: AISpanType.WORKFLOW_SLEEP,
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
        return await fn({
          runId,
          workflowId,
          mastra: this.mastra!,
          runtimeContext,
          inputData: prevOutput,
          runCount: -1,
          tracingContext: {
            currentSpan: sleepUntilSpan,
          },
          getInitData: () => stepResults?.input as any,
          getStepResult: (step: any) => {
            if (!step?.id) {
              return null;
            }

            const result = stepResults[step.id];
            if (result?.status === 'success') {
              return result.output;
            }

            return null;
          },

          // TODO: this function shouldn't have suspend probably?
          suspend: async (_suspendPayload: any): Promise<any> => {},
          bail: () => {},
          abort: () => {
            abortController?.abort();
          },
          [EMITTER_SYMBOL]: emitter,
          [STREAM_FORMAT_SYMBOL]: executionContext.format, // TODO: add streamVNext support
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
        });
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

  async executeWaitForEvent({ event, timeout }: { event: string; timeout?: number }): Promise<any> {
    const eventData = await this.inngestStep.waitForEvent(`user-event-${event}`, {
      event: `user-event-${event}`,
      timeout: timeout ?? 5e3,
    });

    if (eventData === null) {
      throw 'Timeout waiting for event';
    }

    return eventData?.data;
  }

  async executeStep({
    step,
    stepResults,
    executionContext,
    resume,
    prevOutput,
    emitter,
    abortController,
    runtimeContext,
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
    prevOutput: any;
    emitter: Emitter;
    abortController: AbortController;
    runtimeContext: RuntimeContext;
    tracingContext?: TracingContext;
    writableStream?: WritableStream<ChunkType>;
    disableScorers?: boolean;
  }): Promise<StepResult<any, any, any, any>> {
    const stepAISpan = tracingContext?.currentSpan?.createChildSpan({
      name: `workflow step: '${step.id}'`,
      type: AISpanType.WORKFLOW_STEP,
      input: prevOutput,
      attributes: {
        stepId: step.id,
      },
      tracingPolicy: this.options?.tracingPolicy,
    });

    const startedAt = await this.inngestStep.run(
      `workflow.${executionContext.workflowId}.run.${executionContext.runId}.step.${step.id}.running_ev`,
      async () => {
        const startedAt = Date.now();
        await emitter.emit('watch', {
          type: 'watch',
          payload: {
            currentStep: {
              id: step.id,
              status: 'running',
            },
            workflowState: {
              status: 'running',
              steps: {
                ...stepResults,
                [step.id]: {
                  status: 'running',
                },
              },
              result: null,
              error: null,
            },
          },
          eventTimestamp: Date.now(),
        });

        await emitter.emit('watch-v2', {
          type: 'workflow-step-start',
          payload: {
            id: step.id,
            status: 'running',
            payload: prevOutput,
            startedAt,
          },
        });

        return startedAt;
      },
    );

    if (step instanceof InngestWorkflow) {
      const isResume = !!resume?.steps?.length;
      let result: WorkflowResult<any, any>;
      let runId: string;
      if (isResume) {
        // @ts-ignore
        runId = stepResults[resume?.steps?.[0]]?.payload?.__workflow_meta?.runId ?? randomUUID();

        const snapshot: any = await this.mastra?.getStorage()?.loadWorkflowSnapshot({
          workflowName: step.id,
          runId: runId,
        });

        const invokeResp = (await this.inngestStep.invoke(`workflow.${executionContext.workflowId}.step.${step.id}`, {
          function: step.getFunction(),
          data: {
            inputData: prevOutput,
            runId: runId,
            resume: {
              runId: runId,
              steps: resume.steps.slice(1),
              stepResults: snapshot?.context as any,
              resumePayload: resume.resumePayload,
              // @ts-ignore
              resumePath: snapshot?.suspendedPaths?.[resume.steps?.[1]] as any,
            },
          },
        })) as any;
        result = invokeResp.result;
        runId = invokeResp.runId;
      } else {
        const invokeResp = (await this.inngestStep.invoke(`workflow.${executionContext.workflowId}.step.${step.id}`, {
          function: step.getFunction(),
          data: {
            inputData: prevOutput,
          },
        })) as any;
        result = invokeResp.result;
        runId = invokeResp.runId;
      }

      const res = await this.inngestStep.run(
        `workflow.${executionContext.workflowId}.step.${step.id}.nestedwf-results`,
        async () => {
          if (result.status === 'failed') {
            await emitter.emit('watch', {
              type: 'watch',
              payload: {
                currentStep: {
                  id: step.id,
                  status: 'failed',
                  error: result?.error,
                },
                workflowState: {
                  status: 'running',
                  steps: stepResults,
                  result: null,
                  error: null,
                },
              },
              eventTimestamp: Date.now(),
            });

            await emitter.emit('watch-v2', {
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
              // @ts-ignore
              const suspendPath: string[] = [stepName, ...(stepResult?.payload?.__workflow_meta?.path ?? [])];
              executionContext.suspendedPaths[step.id] = executionContext.executionPath;

              await emitter.emit('watch', {
                type: 'watch',
                payload: {
                  currentStep: {
                    id: step.id,
                    status: 'suspended',
                    payload: { ...(stepResult as any)?.payload, __workflow_meta: { runId: runId, path: suspendPath } },
                  },
                  workflowState: {
                    status: 'running',
                    steps: stepResults,
                    result: null,
                    error: null,
                  },
                },
                eventTimestamp: Date.now(),
              });

              await emitter.emit('watch-v2', {
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
                  payload: { ...(stepResult as any)?.payload, __workflow_meta: { runId: runId, path: suspendPath } },
                },
              };
            }

            await emitter.emit('watch', {
              type: 'watch',
              payload: {
                currentStep: {
                  id: step.id,
                  status: 'suspended',
                  payload: {},
                },
                workflowState: {
                  status: 'running',
                  steps: stepResults,
                  result: null,
                  error: null,
                },
              },
              eventTimestamp: Date.now(),
            });

            return {
              executionContext,
              result: {
                status: 'suspended',
                payload: {},
              },
            };
          }

          // is success

          await emitter.emit('watch', {
            type: 'watch',
            payload: {
              currentStep: {
                id: step.id,
                status: 'success',
                output: result?.result,
              },
              workflowState: {
                status: 'running',
                steps: stepResults,
                result: null,
                error: null,
              },
            },
            eventTimestamp: Date.now(),
          });

          await emitter.emit('watch-v2', {
            type: 'workflow-step-result',
            payload: {
              id: step.id,
              status: 'success',
              output: result?.result,
            },
          });

          await emitter.emit('watch-v2', {
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
      return res.result as StepResult<any, any, any, any>;
    }

    const stepRes = await this.inngestStep.run(`workflow.${executionContext.workflowId}.step.${step.id}`, async () => {
      let execResults: {
        status: 'success' | 'failed' | 'suspended' | 'bailed';
        output?: any;
        startedAt: number;
        endedAt?: number;
        payload: any;
        error?: string;
        resumedAt?: number;
        resumePayload?: any;
        suspendedPayload?: any;
        suspendedAt?: number;
      };
      let suspended: { payload: any } | undefined;
      let bailed: { payload: any } | undefined;

      try {
        const result = await step.execute({
          runId: executionContext.runId,
          mastra: this.mastra!,
          runtimeContext,
          writableStream,
          inputData: prevOutput,
          resumeData: resume?.steps[0] === step.id ? resume?.resumePayload : undefined,
          tracingContext: {
            currentSpan: stepAISpan,
          },
          getInitData: () => stepResults?.input as any,
          getStepResult: (step: any) => {
            const result = stepResults[step.id];
            if (result?.status === 'success') {
              return result.output;
            }

            return null;
          },
          suspend: async (suspendPayload: any) => {
            executionContext.suspendedPaths[step.id] = executionContext.executionPath;
            suspended = { payload: suspendPayload };
          },
          bail: (result: any) => {
            bailed = { payload: result };
          },
          resume: {
            steps: resume?.steps?.slice(1) || [],
            resumePayload: resume?.resumePayload,
            // @ts-ignore
            runId: stepResults[step.id]?.payload?.__workflow_meta?.runId,
          },
          [EMITTER_SYMBOL]: emitter,
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
          payload: prevOutput,
          resumedAt: resume?.steps[0] === step.id ? startedAt : undefined,
          resumePayload: resume?.steps[0] === step.id ? resume?.resumePayload : undefined,
        };
      } catch (e) {
        execResults = {
          status: 'failed',
          payload: prevOutput,
          error: e instanceof Error ? e.message : String(e),
          endedAt: Date.now(),
          startedAt,
          resumedAt: resume?.steps[0] === step.id ? startedAt : undefined,
          resumePayload: resume?.steps[0] === step.id ? resume?.resumePayload : undefined,
        };
      }

      if (suspended) {
        execResults = {
          status: 'suspended',
          suspendedPayload: suspended.payload,
          payload: prevOutput,
          suspendedAt: Date.now(),
          startedAt,
          resumedAt: resume?.steps[0] === step.id ? startedAt : undefined,
          resumePayload: resume?.steps[0] === step.id ? resume?.resumePayload : undefined,
        };
      } else if (bailed) {
        execResults = { status: 'bailed', output: bailed.payload, payload: prevOutput, endedAt: Date.now(), startedAt };
      }

      if (execResults.status === 'failed') {
        if (executionContext.retryConfig.attempts > 0 && this.inngestAttempts < executionContext.retryConfig.attempts) {
          const error = new Error(execResults.error);
          stepAISpan?.error({ error });
          throw error;
        }
      }

      await emitter.emit('watch', {
        type: 'watch',
        payload: {
          currentStep: {
            id: step.id,
            ...execResults,
          },
          workflowState: {
            status: 'running',
            steps: { ...stepResults, [step.id]: execResults },
            result: null,
            error: null,
          },
        },
        eventTimestamp: Date.now(),
      });

      if (execResults.status === 'suspended') {
        await emitter.emit('watch-v2', {
          type: 'workflow-step-suspended',
          payload: {
            id: step.id,
            ...execResults,
          },
        });
      } else {
        await emitter.emit('watch-v2', {
          type: 'workflow-step-result',
          payload: {
            id: step.id,
            ...execResults,
          },
        });

        await emitter.emit('watch-v2', {
          type: 'workflow-step-finish',
          payload: {
            id: step.id,
            metadata: {},
          },
        });
      }

      stepAISpan?.end({ output: execResults });

      return { result: execResults, executionContext, stepResults };
    });

    if (disableScorers !== false) {
      await this.inngestStep.run(`workflow.${executionContext.workflowId}.step.${step.id}.score`, async () => {
        if (step.scorers) {
          await this.runScorers({
            scorers: step.scorers,
            runId: executionContext.runId,
            input: prevOutput,
            output: stepRes.result,
            workflowId: executionContext.workflowId,
            stepId: step.id,
            runtimeContext,
            disableScorers,
            tracingContext: { currentSpan: stepAISpan },
          });
        }
      });
    }

    // @ts-ignore
    Object.assign(executionContext.suspendedPaths, stepRes.executionContext.suspendedPaths);
    // @ts-ignore
    Object.assign(stepResults, stepRes.stepResults);

    // @ts-ignore
    return stepRes.result;
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
    runtimeContext: RuntimeContext;
  }) {
    await this.inngestStep.run(
      `workflow.${workflowId}.run.${runId}.path.${JSON.stringify(executionContext.executionPath)}.stepUpdate`,
      async () => {
        await this.mastra?.getStorage()?.persistWorkflowSnapshot({
          workflowName: workflowId,
          runId,
          resourceId,
          snapshot: {
            runId,
            value: {},
            context: stepResults as any,
            activePaths: [],
            suspendedPaths: executionContext.suspendedPaths,
            waitingPaths: {},
            serializedStepGraph,
            status: workflowStatus,
            result,
            error,
            // @ts-ignore
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
    prevStep,
    stepResults,
    serializedStepGraph,
    resume,
    executionContext,
    emitter,
    abortController,
    runtimeContext,
    writableStream,
    disableScorers,
    tracingContext,
  }: {
    workflowId: string;
    runId: string;
    entry: {
      type: 'conditional';
      steps: StepFlowEntry[];
      conditions: ExecuteFunction<any, any, any, any, InngestEngineType>[];
    };
    prevStep: StepFlowEntry;
    serializedStepGraph: SerializedStepFlowEntry[];
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
    runtimeContext: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
    disableScorers?: boolean;
    tracingContext?: TracingContext;
  }): Promise<StepResult<any, any, any, any>> {
    const conditionalSpan = tracingContext?.currentSpan?.createChildSpan({
      type: AISpanType.WORKFLOW_CONDITIONAL,
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
              type: AISpanType.WORKFLOW_CONDITIONAL_EVAL,
              name: `condition: '${index}'`,
              input: prevOutput,
              attributes: {
                conditionIndex: index,
              },
              tracingPolicy: this.options?.tracingPolicy,
            });

            try {
              const result = await cond({
                runId,
                workflowId,
                mastra: this.mastra!,
                runtimeContext,
                runCount: -1,
                inputData: prevOutput,
                tracingContext: {
                  currentSpan: evalSpan,
                },
                getInitData: () => stepResults?.input as any,
                getStepResult: (step: any) => {
                  if (!step?.id) {
                    return null;
                  }

                  const result = stepResults[step.id];
                  if (result?.status === 'success') {
                    return result.output;
                  }

                  return null;
                },

                // TODO: this function shouldn't have suspend probably?
                suspend: async (_suspendPayload: any) => {},
                bail: () => {},
                abort: () => {
                  abortController.abort();
                },
                [EMITTER_SYMBOL]: emitter,
                [STREAM_FORMAT_SYMBOL]: executionContext.format, // TODO: add streamVNext support
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
              });

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

    const results: { result: StepResult<any, any, any, any> }[] = await Promise.all(
      stepsToRun.map((step, index) =>
        this.executeEntry({
          workflowId,
          runId,
          entry: step,
          serializedStepGraph,
          prevStep,
          stepResults,
          resume,
          executionContext: {
            workflowId,
            runId,
            executionPath: [...executionContext.executionPath, index],
            suspendedPaths: executionContext.suspendedPaths,
            retryConfig: executionContext.retryConfig,
            executionSpan: executionContext.executionSpan,
          },
          emitter,
          abortController,
          runtimeContext,
          writableStream,
          disableScorers,
          tracingContext: {
            currentSpan: conditionalSpan,
          },
        }),
      ),
    );
    const hasFailed = results.find(result => result.result.status === 'failed') as {
      result: StepFailure<any, any, any>;
    };
    const hasSuspended = results.find(result => result.result.status === 'suspended');
    if (hasFailed) {
      execResults = { status: 'failed', error: hasFailed.result.error };
    } else if (hasSuspended) {
      execResults = { status: 'suspended', payload: hasSuspended.result.suspendPayload };
    } else {
      execResults = {
        status: 'success',
        output: results.reduce((acc: Record<string, any>, result, index) => {
          if (result.result.status === 'success') {
            // @ts-ignore
            acc[stepsToRun[index]!.step.id] = result.output;
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
