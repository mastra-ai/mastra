import { randomUUID } from 'crypto';
import z from 'zod';
import { Workflow, Run } from '../..';
import type {
  Agent,
  ExecuteFunction,
  ExecutionEngine,
  ExecutionGraph,
  Mastra,
  SerializedStepFlowEntry,
  Step,
  ToolExecutionContext,
  WatchEvent,
  WorkflowConfig,
  WorkflowResult,
} from '../..';
import { RuntimeContext } from '../../di';
import type { PubSub } from '../../events';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Tool } from '../../tools';
import { EMITTER_SYMBOL } from '../constants';
import { EventedExecutionEngine } from './execution-engine';
import { WorkflowEventProcessor } from './workflow-event-processor';

export type EventedEngineType = {};

export function cloneWorkflow<
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, EventedEngineType>[] = Step<
    string,
    any,
    any,
    any,
    any,
    EventedEngineType
  >[],
  TPrevSchema extends z.ZodType<any> = TInput,
>(
  workflow: Workflow<EventedEngineType, TSteps, string, TInput, TOutput, TPrevSchema>,
  opts: { id: TWorkflowId },
): Workflow<EventedEngineType, TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> {
  const wf: Workflow<EventedEngineType, TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> = new Workflow({
    id: opts.id,
    inputSchema: workflow.inputSchema,
    outputSchema: workflow.outputSchema,
    steps: workflow.stepDefs,
    mastra: workflow.mastra,
  });

  wf.setStepFlow(workflow.stepGraph);
  wf.commit();
  return wf;
}

export function cloneStep<TStepId extends string>(
  step: Step<string, any, any, any, any, EventedEngineType>,
  opts: { id: TStepId },
): Step<TStepId, any, any, any, any, EventedEngineType> {
  return {
    id: opts.id,
    description: step.description,
    inputSchema: step.inputSchema,
    outputSchema: step.outputSchema,
    execute: step.execute,
  };
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
    EventedEngineType
  >;
}): Step<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, EventedEngineType>;

export function createStep<
  TStepId extends string,
  TStepInput extends z.ZodObject<{ prompt: z.ZodString }>,
  TStepOutput extends z.ZodObject<{ text: z.ZodString }>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(
  agent: Agent<TStepId, any, any>,
): Step<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, EventedEngineType>;

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
): Step<string, TSchemaIn, TSchemaOut, z.ZodType<any>, z.ZodType<any>, EventedEngineType>;

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
          EventedEngineType
        >;
      }
    | Agent<any, any, any>
    | (Tool<TStepInput, TStepOutput, any> & {
        inputSchema: TStepInput;
        outputSchema: TStepOutput;
        execute: (context: ToolExecutionContext<TStepInput>) => Promise<any>;
      }),
): Step<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, EventedEngineType> {
  if (isAgent(params)) {
    return {
      id: params.name,
      // @ts-ignore
      inputSchema: z.object({
        prompt: z.string(),
        // resourceId: z.string().optional(),
        // threadId: z.string().optional(),
      }),
      // @ts-ignore
      outputSchema: z.object({
        text: z.string(),
      }),
      execute: async ({ inputData, [EMITTER_SYMBOL]: emitter, runtimeContext, abortSignal, abort }) => {
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
        await emitter.emit('watch-v2', {
          type: 'tool-call-streaming-start',
          ...toolData,
        });
        const { fullStream } = await params.stream(inputData.prompt, {
          // resourceId: inputData.resourceId,
          // threadId: inputData.threadId,
          runtimeContext,
          onFinish: result => {
            streamPromise.resolve(result.text);
          },
          abortSignal,
        });

        if (abortSignal.aborted) {
          return abort();
        }

        for await (const chunk of fullStream) {
          switch (chunk.type) {
            case 'text-delta':
              await emitter.emit('watch-v2', {
                type: 'tool-call-delta',
                ...toolData,
                argsTextDelta: chunk.textDelta,
              });
              break;

            case 'step-start':
            case 'step-finish':
            case 'finish':
              break;

            case 'tool-call':
            case 'tool-result':
            case 'tool-call-streaming-start':
            case 'tool-call-delta':
            case 'source':
            case 'file':
            default:
              await emitter.emit('watch-v2', chunk);
              break;
          }
        }

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
      execute: async ({ inputData, mastra, runtimeContext }) => {
        return params.execute({
          context: inputData,
          mastra,
          runtimeContext,
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

export function createWorkflow<
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, EventedEngineType>[] = Step<
    string,
    any,
    any,
    any,
    any,
    EventedEngineType
  >[],
>(params: WorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>) {
  const pubsub = new EventEmitterPubSub();
  const eventProcessor = new WorkflowEventProcessor({ mastra: params.mastra!, pubsub });
  const executionEngine = new EventedExecutionEngine({ mastra: params.mastra!, eventProcessor, pubsub });
  return new EventedWorkflow<EventedEngineType, TSteps, TWorkflowId, TInput, TOutput, TInput>(
    {
      ...params,
      executionEngine,
    },
    pubsub,
  );
}

export class EventedWorkflow<
  TEngineType = EventedEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TPrevSchema extends z.ZodType<any> = TInput,
> extends Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> {
  protected pubsub: PubSub;

  constructor(params: WorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>, pubsub: PubSub) {
    super(params);
    this.pubsub = pubsub;
  }

  __registerMastra(mastra: Mastra) {
    super.__registerMastra(mastra);
    this.executionEngine.__registerMastra(mastra);
  }

  async createRunAsync(options?: { runId?: string }): Promise<Run<TEngineType, TSteps, TInput, TOutput>> {
    const runIdToUse = options?.runId || randomUUID();
    console.log('creating run', runIdToUse);

    // Return a new Run instance with object parameters
    const run: Run<TEngineType, TSteps, TInput, TOutput> =
      this.runs.get(runIdToUse) ??
      new EventedRun(
        {
          workflowId: this.id,
          runId: runIdToUse,
          executionEngine: this.executionEngine,
          executionGraph: this.executionGraph,
          serializedStepGraph: this.serializedStepGraph,
          mastra: this.mastra,
          retryConfig: this.retryConfig,
          cleanup: () => this.runs.delete(runIdToUse),
        },
        this.pubsub,
      );

    this.runs.set(runIdToUse, run);

    const workflowSnapshotInStorage = await this.getWorkflowRunExecutionResult(runIdToUse);

    if (!workflowSnapshotInStorage) {
      await this.mastra?.getStorage()?.persistWorkflowSnapshot({
        workflowName: this.id,
        runId: runIdToUse,
        snapshot: {
          runId: runIdToUse,
          status: 'pending',
          value: {},
          context: {},
          activePaths: [],
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
}

export class EventedRun<
  TEngineType = EventedEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
> extends Run<TEngineType, TSteps, TInput, TOutput> {
  protected pubsub: PubSub;

  constructor(
    params: {
      workflowId: string;
      runId: string;
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
    pubsub: PubSub,
  ) {
    super(params);
    this.pubsub = pubsub;
    this.serializedStepGraph = params.serializedStepGraph;
  }

  async start({
    inputData,
    runtimeContext,
  }: {
    inputData?: z.infer<TInput>;
    runtimeContext?: RuntimeContext;
  }): Promise<WorkflowResult<TOutput, TSteps>> {
    await this.mastra?.getStorage()?.persistWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
      snapshot: {
        runId: this.runId,
        serializedStepGraph: this.serializedStepGraph,
        value: {},
        context: {} as any,
        activePaths: [],
        suspendedPaths: {},
        timestamp: Date.now(),
        status: 'running',
      },
    });

    const result = await this.executionEngine.execute<z.infer<TInput>, WorkflowResult<TOutput, TSteps>>({
      workflowId: this.workflowId,
      runId: this.runId,
      graph: this.executionGraph,
      serializedStepGraph: this.serializedStepGraph,
      input: inputData,
      emitter: {
        emit: async (event: string, data: any) => {
          this.emitter.emit(event, data);
        },
        on: (event: string, callback: (data: any) => void) => {
          this.emitter.on(event, callback);
        },
        off: (event: string, callback: (data: any) => void) => {
          this.emitter.off(event, callback);
        },
        once: (event: string, callback: (data: any) => void) => {
          this.emitter.once(event, callback);
        },
      },
      retryConfig: this.retryConfig,
      runtimeContext: runtimeContext ?? new RuntimeContext(),
      abortController: this.abortController,
    });

    if (result.status !== 'suspended') {
      this.cleanup?.();
    }

    return result;
  }

  async resume<TResumeSchema extends z.ZodType<any>>(params: {
    resumeData?: z.infer<TResumeSchema>;
    step:
      | Step<string, any, any, TResumeSchema, any, TEngineType>
      | [...Step<string, any, any, any, any, TEngineType>[], Step<string, any, any, TResumeSchema, any, TEngineType>]
      | string
      | string[];
    runtimeContext?: RuntimeContext;
  }): Promise<WorkflowResult<TOutput, TSteps>> {
    const steps: string[] = (Array.isArray(params.step) ? params.step : [params.step]).map(step =>
      typeof step === 'string' ? step : step?.id,
    );
    const snapshot = await this.mastra?.getStorage()?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    const executionResultPromise = this.executionEngine
      .execute<z.infer<TInput>, WorkflowResult<TOutput, TSteps>>({
        workflowId: this.workflowId,
        runId: this.runId,
        graph: this.executionGraph,
        serializedStepGraph: this.serializedStepGraph,
        input: params.resumeData,
        resume: {
          steps,
          stepResults: snapshot?.context as any,
          resumePayload: params.resumeData,
          // @ts-ignore
          resumePath: snapshot?.suspendedPaths?.[steps?.[0]] as any,
        },
        emitter: {
          emit: (event: string, data: any) => {
            this.emitter.emit(event, data);
            return Promise.resolve();
          },
          on: (event: string, callback: (data: any) => void) => {
            this.emitter.on(event, callback);
          },
          off: (event: string, callback: (data: any) => void) => {
            this.emitter.off(event, callback);
          },
          once: (event: string, callback: (data: any) => void) => {
            this.emitter.once(event, callback);
          },
        },
        runtimeContext: params.runtimeContext ?? new RuntimeContext(),
        abortController: this.abortController,
      })
      .then(result => {
        if (result.status !== 'suspended') {
          this.closeStreamAction?.().catch(() => {});
        }

        return result;
      });

    this.executionResults = executionResultPromise;

    return executionResultPromise;
  }

  watch(cb: (event: WatchEvent) => void, type: 'watch' | 'watch-v2' = 'watch'): () => void {
    const watchCb = (event: any) => {
      if (event.type === 'watch') {
        cb(event.data);
      }
    };

    this.pubsub.subscribe(`workflow.events.${this.runId}`, watchCb).catch(() => {});

    return () => {
      if (type === 'watch-v2') {
        // TODO
      } else {
      }
    };
  }
}
