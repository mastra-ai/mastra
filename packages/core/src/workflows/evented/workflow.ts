import { randomUUID } from 'crypto';
import z from 'zod';
import type { Agent } from '../../agent';
import { RuntimeContext } from '../../di';
import type { Mastra } from '../../mastra';
import { Tool } from '../../tools';
import type { ToolExecutionContext } from '../../tools/types';
import { Workflow, Run } from '../../workflows';
import type { ExecutionEngine, ExecutionGraph } from '../../workflows/execution-engine';
import type { ExecuteFunction, Step } from '../../workflows/step';
import type { SerializedStepFlowEntry, WorkflowConfig, WorkflowResult, WatchEvent } from '../../workflows/types';
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
        // TODO: support streamVNext
        let streamPromise = {} as {
          promise: Promise<string>;
          resolve: (value: string) => void;
          reject: (reason?: any) => void;
        };

        streamPromise.promise = new Promise((resolve, reject) => {
          streamPromise.resolve = resolve;
          streamPromise.reject = reject;
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

        const toolData = {
          name: params.name,
          args: inputData,
        };

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
      execute: async ({ inputData, mastra, runtimeContext }) => {
        return params.execute({
          context: inputData,
          mastra,
          runtimeContext,
          // TODO: Pass proper tracing context when evented workflows support tracing
          tracingContext: { currentSpan: undefined },
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
  const eventProcessor = new WorkflowEventProcessor({ mastra: params.mastra! });
  const executionEngine = new EventedExecutionEngine({ mastra: params.mastra!, eventProcessor });
  return new EventedWorkflow<EventedEngineType, TSteps, TWorkflowId, TInput, TOutput, TInput>({
    ...params,
    executionEngine,
  });
}

export class EventedWorkflow<
  TEngineType = EventedEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TPrevSchema extends z.ZodType<any> = TInput,
> extends Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> {
  constructor(params: WorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>) {
    super(params);
  }

  __registerMastra(mastra: Mastra) {
    super.__registerMastra(mastra);
    this.executionEngine.__registerMastra(mastra);
  }

  async createRunAsync(options?: { runId?: string }): Promise<Run<TEngineType, TSteps, TInput, TOutput>> {
    const runIdToUse = options?.runId || randomUUID();

    // Return a new Run instance with object parameters
    const run: Run<TEngineType, TSteps, TInput, TOutput> =
      this.runs.get(runIdToUse) ??
      new EventedRun({
        workflowId: this.id,
        runId: runIdToUse,
        executionEngine: this.executionEngine,
        executionGraph: this.executionGraph,
        serializedStepGraph: this.serializedStepGraph,
        mastra: this.mastra,
        retryConfig: this.retryConfig,
        cleanup: () => this.runs.delete(runIdToUse),
      });

    this.runs.set(runIdToUse, run);

    const workflowSnapshotInStorage = await this.getWorkflowRunExecutionResult(runIdToUse, false);

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
          waitingPaths: {},
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
  constructor(params: {
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
  }) {
    super(params);
    this.serializedStepGraph = params.serializedStepGraph;
  }

  async start({
    inputData,
    runtimeContext,
  }: {
    inputData?: z.infer<TInput>;
    runtimeContext?: RuntimeContext;
  }): Promise<WorkflowResult<TOutput, TSteps>> {
    // Add validation checks
    if (this.serializedStepGraph.length === 0) {
      throw new Error(
        'Execution flow of workflow is not defined. Add steps to the workflow via .then(), .branch(), etc.',
      );
    }
    if (!this.executionGraph.steps) {
      throw new Error('Uncommitted step flow changes detected. Call .commit() to register the steps.');
    }

    runtimeContext = runtimeContext ?? new RuntimeContext();

    await this.mastra?.getStorage()?.persistWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
      snapshot: {
        runId: this.runId,
        serializedStepGraph: this.serializedStepGraph,
        value: {},
        context: {} as any,
        runtimeContext: Object.fromEntries(runtimeContext.entries()),
        activePaths: [],
        suspendedPaths: {},
        waitingPaths: {},
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
      runtimeContext,
      abortController: this.abortController,
    });

    console.dir({ startResult: result }, { depth: null });

    if (result.status !== 'suspended') {
      this.cleanup?.();
    }

    return result;
  }

  // TODO: streamVNext

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

    if (steps.length === 0) {
      throw new Error('No steps provided to resume');
    }

    const snapshot = await this.mastra?.getStorage()?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    const resumePath = snapshot?.suspendedPaths?.[steps[0]!] as any;
    if (!resumePath) {
      throw new Error(
        `No resume path found for step ${JSON.stringify(steps)}, currently suspended paths are ${JSON.stringify(snapshot?.suspendedPaths)}`,
      );
    }

    console.dir(
      { resume: { runtimeContextObj: snapshot?.runtimeContext, runtimeContext: params.runtimeContext } },
      { depth: null },
    );
    // Start with the snapshot's runtime context (old values)
    const runtimeContextObj = snapshot?.runtimeContext ?? {};
    const runtimeContext = new RuntimeContext();

    // First, set values from the snapshot
    for (const [key, value] of Object.entries(runtimeContextObj)) {
      runtimeContext.set(key, value);
    }

    // Then, override with any values from the passed runtime context (new values take precedence)
    if (params.runtimeContext) {
      for (const [key, value] of params.runtimeContext.entries()) {
        runtimeContext.set(key, value);
      }
    }

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
          resumePath,
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
        runtimeContext,
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
    const watchCb = async (event: any, ack?: () => Promise<void>) => {
      if (event.runId !== this.runId) {
        return;
      }

      cb(event.data);
      await ack?.();
    };

    if (type === 'watch-v2') {
      this.mastra?.pubsub.subscribe(`workflow.events.v2.${this.runId}`, watchCb).catch(() => {});
    } else {
      this.mastra?.pubsub.subscribe(`workflow.events.${this.runId}`, watchCb).catch(() => {});
    }

    return () => {
      if (type === 'watch-v2') {
        this.mastra?.pubsub.unsubscribe(`workflow.events.v2.${this.runId}`, watchCb).catch(() => {});
      } else {
        this.mastra?.pubsub.unsubscribe(`workflow.events.${this.runId}`, watchCb).catch(() => {});
      }
    };
  }

  async watchAsync(
    cb: (event: WatchEvent) => void,
    type: 'watch' | 'watch-v2' = 'watch',
  ): Promise<() => Promise<void>> {
    const watchCb = async (event: any, ack?: () => Promise<void>) => {
      if (event.runId !== this.runId) {
        return;
      }

      cb(event.data);
      await ack?.();
    };

    if (type === 'watch-v2') {
      await this.mastra?.pubsub.subscribe(`workflow.events.v2.${this.runId}`, watchCb).catch(() => {});
    } else {
      await this.mastra?.pubsub.subscribe(`workflow.events.${this.runId}`, watchCb).catch(() => {});
    }

    return async () => {
      if (type === 'watch-v2') {
        await this.mastra?.pubsub.unsubscribe(`workflow.events.v2.${this.runId}`, watchCb).catch(() => {});
      } else {
        await this.mastra?.pubsub.unsubscribe(`workflow.events.${this.runId}`, watchCb).catch(() => {});
      }
    };
  }

  async cancel() {
    await this.mastra?.pubsub.publish('workflows', {
      type: 'workflow.cancel',
      runId: this.runId,
      data: {
        workflowId: this.workflowId,
        runId: this.runId,
      },
    });
  }

  async sendEvent(eventName: string, data: any) {
    await this.mastra?.pubsub.publish('workflows', {
      type: `workflow.user-event.${eventName}`,
      runId: this.runId,
      data: {
        workflowId: this.workflowId,
        runId: this.runId,
        resumeData: data,
      },
    });
  }
}
