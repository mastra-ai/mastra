import { randomUUID } from 'crypto';
import EventEmitter from 'events';
import type { ReadableStream, WritableStream } from 'node:stream/web';
import { TransformStream } from 'node:stream/web';
import { z } from 'zod';
import type { Mastra, WorkflowRun } from '..';
import type { MastraPrimitives } from '../action';
import { Agent } from '../agent';
import { AISpanType, getOrCreateSpan, getValidTraceId } from '../ai-tracing';
import type { TracingContext, TracingOptions, TracingPolicy } from '../ai-tracing';
import { MastraBase } from '../base';
import { RuntimeContext } from '../di';
import { RegisteredLogger } from '../logger';
import type { MastraScorers } from '../scores';
import { MastraWorkflowStream } from '../stream/MastraWorkflowStream';
import type { ChunkType } from '../stream/types';
import { ChunkFrom } from '../stream/types';
import { Tool } from '../tools';
import type { ToolExecutionContext } from '../tools/types';
import type { DynamicArgument } from '../types';
import { EMITTER_SYMBOL, STREAM_FORMAT_SYMBOL } from './constants';
import { DefaultExecutionEngine } from './default';
import type { ExecutionEngine, ExecutionGraph } from './execution-engine';
import type { ExecuteFunction, Step } from './step';
import type {
  DefaultEngineType,
  DynamicMapping,
  ExtractSchemaFromStep,
  ExtractSchemaType,
  PathsToStringProps,
  SerializedStep,
  SerializedStepFlowEntry,
  StepFlowEntry,
  StepResult,
  StepsRecord,
  StepWithComponent,
  StreamEvent,
  WatchEvent,
  WorkflowConfig,
  WorkflowOptions,
  WorkflowResult,
  WorkflowRunState,
} from './types';

export function mapVariable<TStep extends Step<string, any, any, any, any, any>>({
  step,
  path,
}: {
  step: TStep;
  path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TStep, 'outputSchema'>>> | '.';
}): {
  step: TStep;
  path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TStep, 'outputSchema'>>> | '.';
};
export function mapVariable<TWorkflow extends Workflow<any, any, any, any, any, any>>({
  initData: TWorkflow,
  path,
}: {
  initData: TWorkflow;
  path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TWorkflow, 'inputSchema'>>> | '.';
}): {
  initData: TWorkflow;
  path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TWorkflow, 'inputSchema'>>> | '.';
};
export function mapVariable(config: any): any {
  return config;
}

type StepParams<
  TStepId extends string,
  TStepInput extends z.ZodType<any>,
  TStepOutput extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
> = {
  id: TStepId;
  description?: string;
  inputSchema: TStepInput;
  outputSchema: TStepOutput;
  resumeSchema?: TResumeSchema;
  suspendSchema?: TSuspendSchema;
  retries?: number;
  scorers?: DynamicArgument<MastraScorers>;
  execute: ExecuteFunction<
    z.infer<TStepInput>,
    z.infer<TStepOutput>,
    z.infer<TResumeSchema>,
    z.infer<TSuspendSchema>,
    DefaultEngineType
  >;
};

type ToolStep<
  TSchemaIn extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
  TContext extends ToolExecutionContext<TSchemaIn>,
> = Tool<TSchemaIn, TSchemaOut, TContext> & {
  inputSchema: TSchemaIn;
  outputSchema: TSchemaOut;
  execute: (context: TContext) => Promise<any>;
};

/**
 * Creates a new workflow step
 * @param params Configuration parameters for the step
 * @param params.id Unique identifier for the step
 * @param params.description Optional description of what the step does
 * @param params.inputSchema Zod schema defining the input structure
 * @param params.outputSchema Zod schema defining the output structure
 * @param params.execute Function that performs the step's operations
 * @returns A Step object that can be added to the workflow
 */
export function createStep<
  TStepId extends string,
  TStepInput extends z.ZodType<any>,
  TStepOutput extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(
  params: StepParams<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema>,
): Step<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, DefaultEngineType>;

export function createStep<
  TStepId extends string,
  TStepInput extends z.ZodObject<{ prompt: z.ZodString }>,
  TStepOutput extends z.ZodObject<{ text: z.ZodString }>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(
  agent: Agent<TStepId, any, any>,
): Step<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, DefaultEngineType>;

export function createStep<
  TSchemaIn extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
  TContext extends ToolExecutionContext<TSchemaIn>,
>(
  tool: ToolStep<TSchemaIn, TSchemaOut, TContext>,
): Step<string, TSchemaIn, TSchemaOut, z.ZodType<any>, z.ZodType<any>, DefaultEngineType>;

export function createStep<
  TStepId extends string,
  TStepInput extends z.ZodType<any>,
  TStepOutput extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(
  params:
    | StepParams<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema>
    | Agent<any, any, any>
    | ToolStep<TStepInput, TStepOutput, any>,
): Step<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, DefaultEngineType> {
  if (params instanceof Agent) {
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
      execute: async ({
        inputData,
        [EMITTER_SYMBOL]: emitter,
        [STREAM_FORMAT_SYMBOL]: streamFormat,
        runtimeContext,
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

        // TODO: add support for format, if format is undefined use stream, else streamVNext
        let stream: ReadableStream<any>;

        if (streamFormat === 'aisdk') {
          const { fullStream } = await params.stream(inputData.prompt, {
            // resourceId: inputData.resourceId,
            // threadId: inputData.threadId,
            runtimeContext,
            onFinish: result => {
              streamPromise.resolve(result.text);
            },
            abortSignal,
          });

          stream = fullStream as any;

          await emitter.emit('watch-v2', {
            type: 'tool-call-streaming-start',
            ...(toolData ?? {}),
          });
          for await (const chunk of stream) {
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
        } else {
          const modelOutput = await params.streamVNext(inputData.prompt, {
            runtimeContext,
            onFinish: result => {
              streamPromise.resolve(result.text);
            },
            // abortSignal,
          });

          stream = modelOutput.fullStream;

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
    };
  }

  if (params instanceof Tool) {
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
          mastra,
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
    scorers: params.scorers,
    retries: params.retries,
    execute: params.execute.bind(params),
  };
}

export function cloneStep<TStepId extends string>(
  step: Step<string, any, any, any, any, DefaultEngineType>,
  opts: { id: TStepId },
): Step<TStepId, any, any, any, any, DefaultEngineType> {
  return {
    id: opts.id,
    description: step.description,
    inputSchema: step.inputSchema,
    outputSchema: step.outputSchema,
    execute: step.execute,
    retries: step.retries,
  };
}

export function createWorkflow<
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, DefaultEngineType>[] = Step<
    string,
    any,
    any,
    any,
    any,
    DefaultEngineType
  >[],
>(params: WorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>) {
  return new Workflow<DefaultEngineType, TSteps, TWorkflowId, TInput, TOutput, TInput>(params);
}

export function cloneWorkflow<
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, DefaultEngineType>[] = Step<
    string,
    any,
    any,
    any,
    any,
    DefaultEngineType
  >[],
  TPrevSchema extends z.ZodType<any> = TInput,
>(
  workflow: Workflow<DefaultEngineType, TSteps, string, TInput, TOutput, TPrevSchema>,
  opts: { id: TWorkflowId },
): Workflow<DefaultEngineType, TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> {
  const wf: Workflow<DefaultEngineType, TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> = new Workflow({
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

export class Workflow<
    TEngineType = any,
    TSteps extends Step<string, any, any, any, any, TEngineType>[] = Step<string, any, any, any, any, TEngineType>[],
    TWorkflowId extends string = string,
    TInput extends z.ZodType<any> = z.ZodType<any>,
    TOutput extends z.ZodType<any> = z.ZodType<any>,
    TPrevSchema extends z.ZodType<any> = TInput,
  >
  extends MastraBase
  implements Step<TWorkflowId, TInput, TOutput, any, any, DefaultEngineType>
{
  public id: TWorkflowId;
  public description?: string | undefined;
  public inputSchema: TInput;
  public outputSchema: TOutput;
  public steps: Record<string, StepWithComponent>;
  public stepDefs?: TSteps;
  protected stepFlow: StepFlowEntry<TEngineType>[];
  protected serializedStepFlow: SerializedStepFlowEntry[];
  protected executionEngine: ExecutionEngine;
  protected executionGraph: ExecutionGraph;
  readonly options?: WorkflowOptions;
  public retryConfig: {
    attempts?: number;
    delay?: number;
  };

  #mastra?: Mastra;

  #runs: Map<string, Run<TEngineType, TSteps, TInput, TOutput>> = new Map();

  constructor({
    mastra,
    id,
    inputSchema,
    outputSchema,
    description,
    executionEngine,
    retryConfig,
    steps,
    options,
  }: WorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>) {
    super({ name: id, component: RegisteredLogger.WORKFLOW });
    this.id = id;
    this.description = description;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
    this.retryConfig = retryConfig ?? { attempts: 0, delay: 0 };
    this.executionGraph = this.buildExecutionGraph();
    this.stepFlow = [];
    this.serializedStepFlow = [];
    this.#mastra = mastra;
    this.steps = {};
    this.stepDefs = steps;
    this.options = options;

    if (!executionEngine) {
      // TODO: this should be configured using the Mastra class instance that's passed in
      this.executionEngine = new DefaultExecutionEngine({
        mastra: this.#mastra,
        options: { tracingPolicy: options?.tracingPolicy },
      });
    } else {
      this.executionEngine = executionEngine;
    }

    this.#runs = new Map();
  }

  get runs() {
    return this.#runs;
  }

  get mastra() {
    return this.#mastra;
  }

  __registerMastra(mastra: Mastra) {
    this.#mastra = mastra;
    this.executionEngine.__registerMastra(mastra);
  }

  __registerPrimitives(p: MastraPrimitives) {
    if (p.telemetry) {
      this.__setTelemetry(p.telemetry);
    }

    if (p.logger) {
      this.__setLogger(p.logger);
    }
  }

  setStepFlow(stepFlow: StepFlowEntry<TEngineType>[]) {
    this.stepFlow = stepFlow;
  }

  /**
   * Adds a step to the workflow
   * @param step The step to add to the workflow
   * @returns The workflow instance for chaining
   */
  then<TStepInputSchema extends TPrevSchema, TStepId extends string, TSchemaOut extends z.ZodType<any>>(
    step: Step<TStepId, TStepInputSchema, TSchemaOut, any, any, TEngineType>,
  ) {
    this.stepFlow.push({ type: 'step', step: step as any });
    this.serializedStepFlow.push({
      type: 'step',
      step: {
        id: step.id,
        description: step.description,
        component: (step as SerializedStep).component,
        serializedStepFlow: (step as SerializedStep).serializedStepFlow,
      },
    });
    this.steps[step.id] = step;
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, TSchemaOut>;
  }

  /**
   * Adds a sleep step to the workflow
   * @param duration The duration to sleep for
   * @returns The workflow instance for chaining
   */
  sleep(duration: number | ExecuteFunction<z.infer<TPrevSchema>, number, any, any, TEngineType>) {
    const id = `sleep_${this.#mastra?.generateId() || randomUUID()}`;

    const opts: StepFlowEntry<TEngineType> =
      typeof duration === 'function'
        ? { type: 'sleep', id, fn: duration }
        : { type: 'sleep', id, duration: duration as number };
    const serializedOpts: SerializedStepFlowEntry =
      typeof duration === 'function'
        ? { type: 'sleep', id, fn: duration.toString() }
        : { type: 'sleep', id, duration: duration as number };

    this.stepFlow.push(opts);
    this.serializedStepFlow.push(serializedOpts);
    this.steps[id] = createStep({
      id,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => {
        return {};
      },
    });
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, TPrevSchema>;
  }

  /**
   * Adds a sleep until step to the workflow
   * @param date The date to sleep until
   * @returns The workflow instance for chaining
   */
  sleepUntil(date: Date | ExecuteFunction<z.infer<TPrevSchema>, Date, any, any, TEngineType>) {
    const id = `sleep_${this.#mastra?.generateId() || randomUUID()}`;
    const opts: StepFlowEntry<TEngineType> =
      typeof date === 'function'
        ? { type: 'sleepUntil', id, fn: date }
        : { type: 'sleepUntil', id, date: date as Date };
    const serializedOpts: SerializedStepFlowEntry =
      typeof date === 'function'
        ? { type: 'sleepUntil', id, fn: date.toString() }
        : { type: 'sleepUntil', id, date: date as Date };

    this.stepFlow.push(opts);
    this.serializedStepFlow.push(serializedOpts);
    this.steps[id] = createStep({
      id,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => {
        return {};
      },
    });
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, TPrevSchema>;
  }

  waitForEvent<TStepInputSchema extends TPrevSchema, TStepId extends string, TSchemaOut extends z.ZodType<any>>(
    event: string,
    step: Step<TStepId, TStepInputSchema, TSchemaOut, any, any, TEngineType>,
    opts?: {
      timeout?: number;
    },
  ) {
    this.stepFlow.push({ type: 'waitForEvent', event, step: step as any, timeout: opts?.timeout });
    this.serializedStepFlow.push({
      type: 'waitForEvent',
      event,
      step: {
        id: step.id,
        description: step.description,
        component: (step as SerializedStep).component,
        serializedStepFlow: (step as SerializedStep).serializedStepFlow,
      },
      timeout: opts?.timeout,
    });
    this.steps[step.id] = step;
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, TSchemaOut>;
  }

  map(
    mappingConfig:
      | {
          [k: string]:
            | {
                step: Step<string, any, any, any, any, TEngineType> | Step<string, any, any, any, any, TEngineType>[];
                path: string;
              }
            | { value: any; schema: z.ZodType<any> }
            | {
                initData: Workflow<TEngineType, any, any, any, any, any>;
                path: string;
              }
            | {
                runtimeContextPath: string;
                schema: z.ZodType<any>;
              }
            | DynamicMapping<TPrevSchema, z.ZodType<any>>;
        }
      | ExecuteFunction<z.infer<TPrevSchema>, any, any, any, TEngineType>,
    stepOptions?: { id?: string | null },
  ): Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, any> {
    // Create an implicit step that handles the mapping
    if (typeof mappingConfig === 'function') {
      // @ts-ignore
      const mappingStep: any = createStep({
        id: stepOptions?.id || `mapping_${this.#mastra?.generateId() || randomUUID()}`,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: mappingConfig as any,
      });

      this.stepFlow.push({ type: 'step', step: mappingStep as any });
      this.serializedStepFlow.push({
        type: 'step',
        step: {
          id: mappingStep.id,
          mapConfig: mappingConfig.toString(),
        },
      });
      return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, any>;
    }

    const newMappingConfig: Record<string, any> = Object.entries(mappingConfig).reduce(
      (a, [key, mapping]) => {
        const m: any = mapping;
        if (m.value !== undefined) {
          a[key] = m;
        } else if (m.fn !== undefined) {
          a[key] = {
            fn: m.fn.toString(),
            schema: m.schema,
          };
        } else if (m.runtimeContextPath) {
          a[key] = {
            runtimeContextPath: m.runtimeContextPath,
            schema: m.schema,
          };
        } else {
          a[key] = m;
        }
        return a;
      },
      {} as Record<string, any>,
    );

    const mappingStep: any = createStep({
      id: stepOptions?.id || `mapping_${this.#mastra?.generateId() || randomUUID()}`,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async ctx => {
        const { getStepResult, getInitData, runtimeContext } = ctx;

        const result: Record<string, any> = {};
        for (const [key, mapping] of Object.entries(mappingConfig)) {
          const m: any = mapping;

          if (m.value !== undefined) {
            result[key] = m.value;
            continue;
          }

          if (m.fn !== undefined) {
            result[key] = await m.fn(ctx);
            continue;
          }

          if (m.runtimeContextPath) {
            result[key] = runtimeContext.get(m.runtimeContextPath);
            continue;
          }

          const stepResult = m.initData
            ? getInitData()
            : getStepResult(Array.isArray(m.step) ? m.step.find((s: any) => getStepResult(s)) : m.step);

          if (m.path === '.') {
            result[key] = stepResult;
            continue;
          }

          const pathParts = m.path.split('.');
          let value: any = stepResult;
          for (const part of pathParts) {
            if (typeof value === 'object' && value !== null) {
              value = value[part];
            } else {
              throw new Error(`Invalid path ${m.path} in step ${m?.step?.id ?? 'initData'}`);
            }
          }

          result[key] = value;
        }
        return result as z.infer<typeof mappingStep.outputSchema>;
      },
    });

    type MappedOutputSchema = z.ZodType<any>;

    this.stepFlow.push({ type: 'step', step: mappingStep as any });
    this.serializedStepFlow.push({
      type: 'step',
      step: {
        id: mappingStep.id,
        mapConfig: JSON.stringify(newMappingConfig, null, 2),
      },
    });
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, MappedOutputSchema>;
  }

  // TODO: make typing better here
  parallel<TParallelSteps extends Step<string, TPrevSchema, any, any, any, TEngineType>[]>(steps: TParallelSteps) {
    this.stepFlow.push({ type: 'parallel', steps: steps.map(step => ({ type: 'step', step: step as any })) });
    this.serializedStepFlow.push({
      type: 'parallel',
      steps: steps.map(step => ({
        type: 'step',
        step: {
          id: step.id,
          description: step.description,
          component: (step as SerializedStep).component,
          serializedStepFlow: (step as SerializedStep).serializedStepFlow,
        },
      })),
    });
    steps.forEach(step => {
      this.steps[step.id] = step;
    });
    return this as unknown as Workflow<
      TEngineType,
      TSteps,
      TWorkflowId,
      TInput,
      TOutput,
      z.ZodObject<
        {
          [K in keyof StepsRecord<TParallelSteps>]: StepsRecord<TParallelSteps>[K]['outputSchema'];
        },
        any,
        z.ZodTypeAny
      >
    >;
  }

  // TODO: make typing better here
  branch<
    TBranchSteps extends Array<
      [
        ExecuteFunction<z.infer<TPrevSchema>, any, any, any, TEngineType>,
        Step<string, TPrevSchema, any, any, any, TEngineType>,
      ]
    >,
  >(steps: TBranchSteps) {
    this.stepFlow.push({
      type: 'conditional',
      steps: steps.map(([_cond, step]) => ({ type: 'step', step: step as any })),
      // @ts-ignore
      conditions: steps.map(([cond]) => cond),
      serializedConditions: steps.map(([cond, _step]) => ({ id: `${_step.id}-condition`, fn: cond.toString() })),
    });
    this.serializedStepFlow.push({
      type: 'conditional',
      steps: steps.map(([_cond, step]) => ({
        type: 'step',
        step: {
          id: step.id,
          description: step.description,
          component: (step as SerializedStep).component,
          serializedStepFlow: (step as SerializedStep).serializedStepFlow,
        },
      })),
      serializedConditions: steps.map(([cond, _step]) => ({ id: `${_step.id}-condition`, fn: cond.toString() })),
    });
    steps.forEach(([_, step]) => {
      this.steps[step.id] = step;
    });

    // Extract just the Step elements from the tuples array
    type BranchStepsArray = { [K in keyof TBranchSteps]: TBranchSteps[K][1] };

    // This creates a mapped type that extracts the second element from each tuple
    type ExtractedSteps = BranchStepsArray[number];

    // Now we can use this type as an array, similar to TParallelSteps
    return this as unknown as Workflow<
      TEngineType,
      TSteps,
      TWorkflowId,
      TInput,
      TOutput,
      z.ZodObject<
        {
          [K in keyof StepsRecord<ExtractedSteps[]>]: StepsRecord<ExtractedSteps[]>[K]['outputSchema'];
        },
        any,
        z.ZodTypeAny
      >
    >;
  }

  dowhile<TStepInputSchema extends TPrevSchema, TStepId extends string, TSchemaOut extends z.ZodType<any>>(
    step: Step<TStepId, TStepInputSchema, TSchemaOut, any, any, TEngineType>,
    condition: ExecuteFunction<z.infer<TSchemaOut>, any, any, any, TEngineType>,
  ) {
    this.stepFlow.push({
      type: 'loop',
      step: step as any,
      // @ts-ignore
      condition,
      loopType: 'dowhile',
      serializedCondition: { id: `${step.id}-condition`, fn: condition.toString() },
    });
    this.serializedStepFlow.push({
      type: 'loop',
      step: {
        id: step.id,
        description: step.description,
        component: (step as SerializedStep).component,
        serializedStepFlow: (step as SerializedStep).serializedStepFlow,
      },
      serializedCondition: { id: `${step.id}-condition`, fn: condition.toString() },
      loopType: 'dowhile',
    });
    this.steps[step.id] = step;
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, TSchemaOut>;
  }

  dountil<TStepInputSchema extends TPrevSchema, TStepId extends string, TSchemaOut extends z.ZodType<any>>(
    step: Step<TStepId, TStepInputSchema, TSchemaOut, any, any, TEngineType>,
    condition: ExecuteFunction<z.infer<TSchemaOut>, any, any, any, TEngineType>,
  ) {
    this.stepFlow.push({
      type: 'loop',
      step: step as any,
      // @ts-ignore
      condition,
      loopType: 'dountil',
      serializedCondition: { id: `${step.id}-condition`, fn: condition.toString() },
    });
    this.serializedStepFlow.push({
      type: 'loop',
      step: {
        id: step.id,
        description: step.description,
        component: (step as SerializedStep).component,
        serializedStepFlow: (step as SerializedStep).serializedStepFlow,
      },
      serializedCondition: { id: `${step.id}-condition`, fn: condition.toString() },
      loopType: 'dountil',
    });
    this.steps[step.id] = step;
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, TSchemaOut>;
  }

  foreach<
    TPrevIsArray extends TPrevSchema extends z.ZodArray<any> ? true : false,
    TStepInputSchema extends TPrevSchema extends z.ZodArray<infer TElement> ? TElement : never,
    TStepId extends string,
    TSchemaOut extends z.ZodType<any>,
  >(
    step: TPrevIsArray extends true
      ? Step<TStepId, TStepInputSchema, TSchemaOut, any, any, TEngineType>
      : 'Previous step must return an array type',
    opts?: {
      concurrency: number;
    },
  ) {
    this.stepFlow.push({ type: 'foreach', step: step as any, opts: opts ?? { concurrency: 1 } });
    this.serializedStepFlow.push({
      type: 'foreach',
      step: {
        id: (step as SerializedStep).id,
        description: (step as SerializedStep).description,
        component: (step as SerializedStep).component,
        serializedStepFlow: (step as SerializedStep).serializedStepFlow,
      },
      opts: opts ?? { concurrency: 1 },
    });
    this.steps[(step as any).id] = step as any;
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, z.ZodArray<TSchemaOut>>;
  }

  /**
   * Builds the execution graph for this workflow
   * @returns The execution graph that can be used to execute the workflow
   */
  buildExecutionGraph(): ExecutionGraph {
    return {
      id: this.id,
      steps: this.stepFlow,
    };
  }

  /**
   * Finalizes the workflow definition and prepares it for execution
   * This method should be called after all steps have been added to the workflow
   * @returns A built workflow instance ready for execution
   */
  commit() {
    this.executionGraph = this.buildExecutionGraph();
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, TOutput>;
  }

  get stepGraph() {
    return this.stepFlow;
  }

  get serializedStepGraph() {
    return this.serializedStepFlow;
  }

  /**
   * @deprecated Use createRunAsync() instead.
   * @throws {Error} Always throws an error directing users to use createRunAsync()
   */
  createRun(_options?: {
    runId?: string;
    resourceId?: string;
    disableScorers?: boolean;
  }): Run<TEngineType, TSteps, TInput, TOutput> {
    throw new Error(
      'createRun() has been deprecated. ' +
        'Please use createRunAsync() instead.\n\n' +
        'Migration guide:\n' +
        '  Before: const run = workflow.createRun();\n' +
        '  After:  const run = await workflow.createRunAsync();\n\n' +
        'Note: createRunAsync() is an async method, so make sure your calling function is async.',
    );
  }

  /**
   * Creates a new workflow run instance and stores a snapshot of the workflow in the storage
   * @param options Optional configuration for the run
   * @param options.runId Optional custom run ID, defaults to a random UUID
   * @param options.resourceId Optional resource ID to associate with this run
   * @param options.disableScorers Optional flag to disable scorers for this run
   * @returns A Run instance that can be used to execute the workflow
   */
  async createRunAsync(options?: {
    runId?: string;
    resourceId?: string;
    disableScorers?: boolean;
  }): Promise<Run<TEngineType, TSteps, TInput, TOutput>> {
    if (this.stepFlow.length === 0) {
      throw new Error(
        'Execution flow of workflow is not defined. Add steps to the workflow via .then(), .branch(), etc.',
      );
    }
    if (!this.executionGraph.steps) {
      throw new Error('Uncommitted step flow changes detected. Call .commit() to register the steps.');
    }
    const runIdToUse = options?.runId || this.#mastra?.generateId() || randomUUID();

    // Return a new Run instance with object parameters
    const run =
      this.#runs.get(runIdToUse) ??
      new Run({
        workflowId: this.id,
        runId: runIdToUse,
        resourceId: options?.resourceId,
        executionEngine: this.executionEngine,
        executionGraph: this.executionGraph,
        mastra: this.#mastra,
        retryConfig: this.retryConfig,
        serializedStepGraph: this.serializedStepGraph,
        disableScorers: options?.disableScorers,
        cleanup: () => this.#runs.delete(runIdToUse),
        tracingPolicy: this.options?.tracingPolicy,
      });

    this.#runs.set(runIdToUse, run);

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

  async getScorers({
    runtimeContext = new RuntimeContext(),
  }: { runtimeContext?: RuntimeContext } = {}): Promise<MastraScorers> {
    const steps = this.steps;

    if (!steps || Object.keys(steps).length === 0) {
      return {};
    }

    const scorers: MastraScorers = {};

    for (const step of Object.values(steps)) {
      if (step.scorers) {
        let scorersToUse = step.scorers;

        if (typeof scorersToUse === 'function') {
          scorersToUse = await scorersToUse({ runtimeContext });
        }

        for (const [id, scorer] of Object.entries(scorersToUse)) {
          scorers[id] = scorer;
        }
      }
    }

    return scorers;
  }

  // This method should only be called internally for nested workflow execution, as well as from mastra server handlers
  // To run a workflow use `.createRunAsync` and then `.start` or `.resume`
  async execute({
    runId,
    inputData,
    resumeData,
    suspend,
    resume,
    [EMITTER_SYMBOL]: emitter,
    mastra,
    runtimeContext,
    abort,
    abortSignal,
    runCount,
    tracingContext,
    writer,
  }: {
    runId?: string;
    inputData: z.infer<TInput>;
    resumeData?: any;
    getStepResult<T extends Step<any, any, any, any, any, TEngineType>>(
      stepId: T,
    ): T['outputSchema'] extends undefined ? unknown : z.infer<NonNullable<T['outputSchema']>>;
    suspend: (suspendPayload: any) => Promise<any>;
    resume?: {
      steps: string[];
      resumePayload: any;
      runId?: string;
    };
    [EMITTER_SYMBOL]: { emit: (event: string, data: any) => void };
    mastra: Mastra;
    runtimeContext?: RuntimeContext;
    engine: DefaultEngineType;
    abortSignal: AbortSignal;
    bail: (result: any) => any;
    abort: () => any;
    runCount?: number;
    tracingContext?: TracingContext;
    writer?: WritableStream<ChunkType>;
  }): Promise<z.infer<TOutput>> {
    this.__registerMastra(mastra);

    const isResume = !!(resume?.steps && resume.steps.length > 0);
    const run = isResume ? await this.createRunAsync({ runId: resume.runId }) : await this.createRunAsync({ runId });
    const nestedAbortCb = () => {
      abort();
    };
    run.abortController.signal.addEventListener('abort', nestedAbortCb);
    abortSignal.addEventListener('abort', async () => {
      run.abortController.signal.removeEventListener('abort', nestedAbortCb);
      await run.cancel();
    });

    const unwatchV2 = run.watch(event => {
      emitter.emit('nested-watch-v2', { event, workflowId: this.id });
    }, 'watch-v2');
    const unwatch = run.watch(event => {
      emitter.emit('nested-watch', { event, workflowId: this.id, runId: run.runId, isResume: !!resume?.steps?.length });
    }, 'watch');

    if (runCount && runCount > 0 && resume?.steps?.length && runtimeContext) {
      runtimeContext.set('__mastraWorflowInputData', inputData);
    }

    const res = isResume
      ? await run.resume({ resumeData, step: resume.steps as any, runtimeContext, tracingContext })
      : await run.start({ inputData, runtimeContext, tracingContext, writableStream: writer });
    unwatch();
    unwatchV2();
    const suspendedSteps = Object.entries(res.steps).filter(([_stepName, stepResult]) => {
      const stepRes: StepResult<any, any, any, any> = stepResult as StepResult<any, any, any, any>;
      return stepRes?.status === 'suspended';
    });

    if (suspendedSteps?.length) {
      for (const [stepName, stepResult] of suspendedSteps) {
        // @ts-ignore
        const suspendPath: string[] = [stepName, ...(stepResult?.suspendPayload?.__workflow_meta?.path ?? [])];
        await suspend({
          ...(stepResult as any)?.suspendPayload,
          __workflow_meta: { runId: run.runId, path: suspendPath },
        });
      }
    }

    if (res.status === 'failed') {
      throw res.error;
    }

    return res.status === 'success' ? res.result : undefined;
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
      this.logger.debug('Cannot get workflow runs. Mastra storage is not initialized');
      return { runs: [], total: 0 };
    }

    return storage.getWorkflowRuns({ workflowName: this.id, ...(args ?? {}) });
  }

  async getWorkflowRunById(runId: string) {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      this.logger.debug('Cannot get workflow runs from storage. Mastra storage is not initialized');
      //returning in memory run if no storage is initialized
      return this.#runs.get(runId)
        ? ({ ...this.#runs.get(runId), workflowName: this.id } as unknown as WorkflowRun)
        : null;
    }
    const run = await storage.getWorkflowRunById({ runId, workflowName: this.id });

    return (
      run ??
      (this.#runs.get(runId) ? ({ ...this.#runs.get(runId), workflowName: this.id } as unknown as WorkflowRun) : null)
    );
  }

  protected async getWorkflowRunSteps({ runId, workflowId }: { runId: string; workflowId: string }) {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      this.logger.debug('Cannot get workflow run steps. Mastra storage is not initialized');
      return {};
    }

    const run = await storage.getWorkflowRunById({ runId, workflowName: workflowId });

    let snapshot: WorkflowRunState | string = run?.snapshot!;

    if (!snapshot) {
      return {};
    }

    if (typeof snapshot === 'string') {
      // this occurs whenever the parsing of snapshot fails in storage
      try {
        snapshot = JSON.parse(snapshot);
      } catch (e) {
        this.logger.debug('Cannot get workflow run execution result. Snapshot is not a valid JSON string', e);
        return {};
      }
    }

    const { serializedStepGraph, context } = snapshot as WorkflowRunState;
    const { input, ...steps } = context;

    let finalSteps = {} as Record<string, StepResult<any, any, any, any>>;

    for (const step of Object.keys(steps)) {
      const stepGraph = serializedStepGraph.find(stepGraph => (stepGraph as any)?.step?.id === step);
      finalSteps[step] = steps[step] as StepResult<any, any, any, any>;
      if (stepGraph && (stepGraph as any)?.step?.component === 'WORKFLOW') {
        const nestedSteps = await this.getWorkflowRunSteps({ runId, workflowId: step });
        if (nestedSteps) {
          const updatedNestedSteps = Object.entries(nestedSteps).reduce(
            (acc, [key, value]) => {
              acc[`${step}.${key}`] = value as StepResult<any, any, any, any>;
              return acc;
            },
            {} as Record<string, StepResult<any, any, any, any>>,
          );
          finalSteps = { ...finalSteps, ...updatedNestedSteps };
        }
      }
    }

    return finalSteps;
  }

  async getWorkflowRunExecutionResult(
    runId: string,
    withNestedWorkflows: boolean = true,
  ): Promise<WatchEvent['payload']['workflowState'] | null> {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      this.logger.debug('Cannot get workflow run execution result. Mastra storage is not initialized');
      return null;
    }

    const run = await storage.getWorkflowRunById({ runId, workflowName: this.id });

    let snapshot: WorkflowRunState | string = run?.snapshot!;

    if (!snapshot) {
      return null;
    }

    if (typeof snapshot === 'string') {
      // this occurs whenever the parsing of snapshot fails in storage
      try {
        snapshot = JSON.parse(snapshot);
      } catch (e) {
        this.logger.debug('Cannot get workflow run execution result. Snapshot is not a valid JSON string', e);
        return null;
      }
    }

    const fullSteps = withNestedWorkflows
      ? await this.getWorkflowRunSteps({ runId, workflowId: this.id })
      : (snapshot as WorkflowRunState).context;

    return {
      status: (snapshot as WorkflowRunState).status,
      result: (snapshot as WorkflowRunState).result,
      error: (snapshot as WorkflowRunState).error,
      payload: (snapshot as WorkflowRunState).context?.input,
      steps: fullSteps as any,
    };
  }
}

/**
 * Represents a workflow run that can be executed
 */

export class Run<
  TEngineType = any,
  TSteps extends Step<string, any, any, any, any, TEngineType>[] = Step<string, any, any, any, any, TEngineType>[],
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
> {
  #abortController?: AbortController;
  protected emitter: EventEmitter;
  /**
   * Unique identifier for this workflow
   */
  readonly workflowId: string;

  /**
   * Unique identifier for this run
   */
  readonly runId: string;

  /**
   * Unique identifier for the resource this run is associated with
   */
  readonly resourceId?: string;

  /**
   * Whether to disable scorers for this run
   */
  readonly disableScorers?: boolean;

  /**
   * Options around how to trace this run
   */
  readonly tracingPolicy?: TracingPolicy;

  /**
   * Internal state of the workflow run
   */
  protected state: Record<string, any> = {};

  /**
   * The execution engine for this run
   */
  public executionEngine: ExecutionEngine;

  /**
   * The execution graph for this run
   */
  public executionGraph: ExecutionGraph;

  /**
   * The serialized step graph for this run
   */
  public serializedStepGraph: SerializedStepFlowEntry[];

  /**
   * The storage for this run
   */
  #mastra?: Mastra;

  #observerHandlers: (() => void)[] = [];

  get mastra() {
    return this.#mastra;
  }

  protected closeStreamAction?: () => Promise<void>;
  protected activeStream?: MastraWorkflowStream<TOutput, TSteps>;
  protected executionResults?: Promise<WorkflowResult<TOutput, TSteps>>;

  protected cleanup?: () => void;

  protected retryConfig?: {
    attempts?: number;
    delay?: number;
  };

  constructor(params: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    executionEngine: ExecutionEngine;
    executionGraph: ExecutionGraph;
    mastra?: Mastra;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    cleanup?: () => void;
    serializedStepGraph: SerializedStepFlowEntry[];
    disableScorers?: boolean;
    tracingPolicy?: TracingPolicy;
  }) {
    this.workflowId = params.workflowId;
    this.runId = params.runId;
    this.resourceId = params.resourceId;
    this.serializedStepGraph = params.serializedStepGraph;
    this.executionEngine = params.executionEngine;
    this.executionGraph = params.executionGraph;
    this.#mastra = params.mastra;
    this.emitter = new EventEmitter();
    this.retryConfig = params.retryConfig;
    this.cleanup = params.cleanup;
    this.disableScorers = params.disableScorers;
    this.tracingPolicy = params.tracingPolicy;
  }

  public get abortController(): AbortController {
    if (!this.#abortController) {
      this.#abortController = new AbortController();
    }

    return this.#abortController;
  }

  /**
   * Cancels the workflow execution
   */
  async cancel() {
    this.abortController?.abort();
  }

  async sendEvent(event: string, data: any) {
    this.emitter.emit(`user-event-${event}`, data);
  }

  protected async _start({
    inputData,
    runtimeContext,
    writableStream,
    tracingContext,
    tracingOptions,
    format,
  }: {
    inputData?: z.infer<TInput>;
    runtimeContext?: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    format?: 'aisdk' | 'mastra' | undefined;
  }): Promise<WorkflowResult<TOutput, TSteps>> {
    // note: this span is ended inside this.executionEngine.execute()
    const workflowAISpan = getOrCreateSpan({
      type: AISpanType.WORKFLOW_RUN,
      name: `workflow run: '${this.workflowId}'`,
      input: inputData,
      attributes: {
        workflowId: this.workflowId,
      },
      tracingPolicy: this.tracingPolicy,
      tracingOptions,
      tracingContext,
      runtimeContext,
    });

    const traceId = getValidTraceId(workflowAISpan);

    const result = await this.executionEngine.execute<z.infer<TInput>, WorkflowResult<TOutput, TSteps>>({
      workflowId: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      disableScorers: this.disableScorers,
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
      writableStream,
      workflowAISpan,
      format,
    });

    if (result.status !== 'suspended') {
      this.cleanup?.();
    }

    result.traceId = traceId;
    return result;
  }

  /**
   * Starts the workflow execution with the provided input
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  async start({
    inputData,
    runtimeContext,
    writableStream,
    tracingContext,
    tracingOptions,
  }: {
    inputData?: z.infer<TInput>;
    runtimeContext?: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
  }): Promise<WorkflowResult<TOutput, TSteps>> {
    return this._start({
      inputData,
      runtimeContext,
      writableStream,
      tracingContext,
      tracingOptions,
      format: 'aisdk',
    });
  }

  /**
   * Starts the workflow execution with the provided input as a stream
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  stream({
    inputData,
    runtimeContext,
    onChunk,
    tracingContext,
  }: {
    inputData?: z.infer<TInput>;
    runtimeContext?: RuntimeContext;
    tracingContext?: TracingContext;
    onChunk?: (chunk: StreamEvent) => Promise<unknown>;
  } = {}): {
    stream: ReadableStream<StreamEvent>;
    getWorkflowState: () => Promise<WorkflowResult<TOutput, TSteps>>;
  } {
    if (this.closeStreamAction) {
      return {
        stream: this.observeStream().stream,
        getWorkflowState: () => this.executionResults!,
      };
    }

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
        if (onChunk) {
          await onChunk(e as any);
        }
      } catch {}
    }, 'watch-v2');

    this.closeStreamAction = async () => {
      this.emitter.emit('watch-v2', {
        type: 'workflow-finish',
        payload: { runId: this.runId },
      });
      unwatch();
      await Promise.all(this.#observerHandlers.map(handler => handler()));
      this.#observerHandlers = [];

      try {
        await writer.close();
      } catch (err) {
        console.error('Error closing stream:', err);
      } finally {
        writer.releaseLock();
      }
    };

    this.emitter.emit('watch-v2', {
      type: 'workflow-start',
      payload: { runId: this.runId },
    });
    this.executionResults = this._start({
      inputData,
      runtimeContext,
      format: 'aisdk',
      tracingContext,
    }).then(result => {
      if (result.status !== 'suspended') {
        this.closeStreamAction?.().catch(() => {});
      }

      return result;
    });

    return {
      stream: readable,
      getWorkflowState: () => this.executionResults!,
    };
  }

  /**
   * Observe the workflow stream
   * @returns A readable stream of the workflow events
   */
  observeStream(): {
    stream: ReadableStream<StreamEvent>;
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

    this.#observerHandlers.push(async () => {
      unwatch();
      try {
        await writer.close();
      } catch (err) {
        console.error('Error closing stream:', err);
      } finally {
        writer.releaseLock();
      }
    });

    return {
      stream: readable,
    };
  }

  /**
   * Observe the workflow stream
   * @returns A readable stream of the workflow events
   */
  observeStreamVNext(): {
    stream: ReadableStream<StreamEvent>;
  } {
    const { readable, writable } = new TransformStream<StreamEvent, StreamEvent>();

    const writer = writable.getWriter();
    const unwatch = this.watch(async event => {
      try {
        // watch-v2 events are data stream events, so we need to cast them to the correct type
        await writer.write(event as any);
      } catch {}
    }, 'watch-v2');

    this.#observerHandlers.push(async () => {
      unwatch();
      try {
        await writer.close();
      } catch (err) {
        console.error('Error closing stream:', err);
      } finally {
        writer.releaseLock();
      }
    });

    return {
      stream: readable,
    };
  }

  async streamAsync({
    inputData,
    runtimeContext,
  }: { inputData?: z.infer<TInput>; runtimeContext?: RuntimeContext } = {}): Promise<{
    stream: ReadableStream<StreamEvent>;
    getWorkflowState: () => Promise<WorkflowResult<TOutput, TSteps>>;
  }> {
    return this.stream({ inputData, runtimeContext });
  }

  /**
   * Starts the workflow execution with the provided input as a stream
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  streamVNext({
    inputData,
    runtimeContext,
    tracingContext,
    format,
  }: {
    inputData?: z.infer<TInput>;
    runtimeContext?: RuntimeContext;
    tracingContext?: TracingContext;
    format?: 'aisdk' | 'mastra' | undefined;
  } = {}): MastraWorkflowStream<TOutput, TSteps> {
    if (this.closeStreamAction && this.activeStream) {
      return this.activeStream;
    }

    this.closeStreamAction = async () => {};

    this.activeStream = new MastraWorkflowStream<TOutput, TSteps>({
      run: this,
      createStream: () => {
        const { readable, writable } = new TransformStream<ChunkType, ChunkType>({
          transform(chunk, controller) {
            controller.enqueue(chunk);
          },
        });

        let buffer: ChunkType[] = [];
        let isWriting = false;
        const tryWrite = async () => {
          const chunkToWrite = buffer;
          buffer = [];

          if (chunkToWrite.length === 0 || isWriting) {
            return;
          }
          isWriting = true;

          let watchWriter = writable.getWriter();

          try {
            for (const chunk of chunkToWrite) {
              await watchWriter.write(chunk);
            }
          } finally {
            watchWriter.releaseLock();
          }
          isWriting = false;

          setImmediate(tryWrite);
        };

        // TODO: fix this, watch-v2 doesn't have a type
        // @ts-ignore
        const unwatch = this.watch(async ({ type, from = ChunkFrom.WORKFLOW, payload }) => {
          buffer.push({
            type,
            runId: this.runId,
            from,
            payload: {
              stepName: (payload as unknown as { id: string }).id,
              ...payload,
            },
          });

          await tryWrite();
        }, 'watch-v2');

        this.closeStreamAction = async () => {
          unwatch();

          try {
            await writable.close();
          } catch (err) {
            console.error('Error closing stream:', err);
          }
        };

        const executionResults = this._start({
          inputData,
          runtimeContext,
          tracingContext,
          writableStream: writable,
          format,
        }).then(result => {
          // always close stream, even if the workflow is suspended
          // this will trigger a finish event with workflow status set to suspended
          this.closeStreamAction?.().catch(() => {});

          return result;
        });
        this.executionResults = executionResults;

        return readable;
      },
    });

    return this.activeStream;
  }

  /**
   * Resumes the workflow execution with the provided input as a stream
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  resumeStreamVNext({
    step,
    resumeData,
    runtimeContext,
    tracingContext,
    format,
  }: {
    resumeData?: z.infer<TInput>;
    step?: Step<string, any, any, any, any, TEngineType>;
    runtimeContext?: RuntimeContext;
    tracingContext?: TracingContext;
    format?: 'aisdk' | 'mastra' | undefined;
  } = {}) {
    if (this.closeStreamAction && this.activeStream) {
      return this.activeStream;
    }

    this.closeStreamAction = async () => {};

    this.activeStream = new MastraWorkflowStream({
      run: this,
      createStream: () => {
        const { readable, writable } = new TransformStream<ChunkType, ChunkType>({
          transform(chunk, controller) {
            controller.enqueue(chunk);
          },
        });

        let buffer: ChunkType[] = [];
        let isWriting = false;
        const tryWrite = async () => {
          const chunkToWrite = buffer;
          buffer = [];

          if (chunkToWrite.length === 0 || isWriting) {
            return;
          }
          isWriting = true;

          let watchWriter = writable.getWriter();

          try {
            for (const chunk of chunkToWrite) {
              await watchWriter.write(chunk);
            }
          } finally {
            watchWriter.releaseLock();
          }
          isWriting = false;

          setImmediate(tryWrite);
        };

        // TODO: fix this, watch-v2 doesn't have a type
        // @ts-ignore
        const unwatch = this.watch(async ({ type, from = ChunkFrom.WORKFLOW, payload }) => {
          buffer.push({
            type,
            runId: this.runId,
            from,
            payload: {
              stepName: (payload as unknown as { id: string }).id,
              ...payload,
            },
          });

          await tryWrite();
        }, 'watch-v2');

        this.closeStreamAction = async () => {
          unwatch();

          try {
            await writable.close();
          } catch (err) {
            console.error('Error closing stream:', err);
          }
        };

        const executionResults = this._resume({
          resumeData,
          step,
          runtimeContext,
          tracingContext,
          writableStream: writable,
          format,
          isVNext: true,
        }).then(result => {
          // always close stream, even if the workflow is suspended
          // this will trigger a finish event with workflow status set to suspended
          this.closeStreamAction?.().catch(() => {});

          return result;
        });
        this.executionResults = executionResults;

        return readable;
      },
    });

    return this.activeStream;
  }

  watch(cb: (event: WatchEvent) => void, type: 'watch' | 'watch-v2' = 'watch'): () => void {
    const watchCb = (event: WatchEvent) => {
      this.updateState(event.payload);
      cb({ type: event.type, payload: this.getState() as any, eventTimestamp: event.eventTimestamp });
    };

    const nestedWatchCb = ({ event, workflowId }: { event: WatchEvent; workflowId: string }) => {
      try {
        const { type, payload, eventTimestamp } = event;
        const prefixedSteps = Object.fromEntries(
          Object.entries(payload?.workflowState?.steps ?? {}).map(([stepId, step]) => [
            `${workflowId}.${stepId}`,
            step,
          ]),
        );
        const newPayload: any = {
          currentStep: {
            ...payload?.currentStep,
            id: `${workflowId}.${payload?.currentStep?.id}`,
          },
          workflowState: {
            steps: prefixedSteps,
          },
        };
        this.updateState(newPayload);
        cb({ type, payload: this.getState() as any, eventTimestamp: eventTimestamp });
      } catch (e) {
        console.error(e);
      }
    };

    const nestedWatchV2Cb = ({
      event,
      workflowId,
    }: {
      event: { type: string; payload: { id: string } & Record<string, unknown> };
      workflowId: string;
    }) => {
      this.emitter.emit('watch-v2', {
        ...event,
        ...(event.payload?.id ? { payload: { ...event.payload, id: `${workflowId}.${event.payload.id}` } } : {}),
      });
    };

    if (type === 'watch') {
      this.emitter.on('watch', watchCb);
      this.emitter.on('nested-watch', nestedWatchCb);
    } else if (type === 'watch-v2') {
      this.emitter.on('watch-v2', cb);
      this.emitter.on('nested-watch-v2', nestedWatchV2Cb);
    }

    return () => {
      if (type === 'watch-v2') {
        this.emitter.off('watch-v2', cb);
        this.emitter.off('nested-watch-v2', nestedWatchV2Cb);
      } else {
        this.emitter.off('watch', watchCb);
        this.emitter.off('nested-watch', nestedWatchCb);
      }
    };
  }

  async watchAsync(cb: (event: WatchEvent) => void, type: 'watch' | 'watch-v2' = 'watch'): Promise<() => void> {
    return this.watch(cb, type);
  }

  async resume<TResumeSchema extends z.ZodType<any>>(params: {
    resumeData?: z.infer<TResumeSchema>;
    step?:
      | Step<string, any, any, TResumeSchema, any, TEngineType>
      | [...Step<string, any, any, any, any, TEngineType>[], Step<string, any, any, TResumeSchema, any, TEngineType>]
      | string
      | string[];
    runtimeContext?: RuntimeContext;
    runCount?: number;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    writableStream?: WritableStream<ChunkType>;
  }): Promise<WorkflowResult<TOutput, TSteps>> {
    return this._resume(params);
  }

  protected async _resume<TResumeSchema extends z.ZodType<any>>(params: {
    resumeData?: z.infer<TResumeSchema>;
    step?:
      | Step<string, any, any, TResumeSchema, any, TEngineType>
      | [...Step<string, any, any, any, any, TEngineType>[], Step<string, any, any, TResumeSchema, any, TEngineType>]
      | string
      | string[];
    runtimeContext?: RuntimeContext;
    runCount?: number;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    writableStream?: WritableStream<ChunkType>;
    format?: 'aisdk' | 'mastra' | undefined;
    isVNext?: boolean;
  }): Promise<WorkflowResult<TOutput, TSteps>> {
    const snapshot = await this.#mastra?.getStorage()?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    if (!snapshot) {
      throw new Error('No snapshot found for this workflow run');
    }

    // Auto-detect suspended steps if no step is provided
    let steps: string[];
    if (params.step) {
      steps = (Array.isArray(params.step) ? params.step : [params.step]).map(step =>
        typeof step === 'string' ? step : step?.id,
      );
    } else {
      // Use suspendedPaths to detect suspended steps
      const suspendedStepPaths: string[][] = [];

      Object.entries(snapshot?.suspendedPaths ?? {}).forEach(([stepId, _executionPath]) => {
        // Check if this step has nested workflow suspension data
        const stepResult = snapshot?.context?.[stepId];
        if (stepResult && typeof stepResult === 'object' && 'status' in stepResult) {
          const stepRes = stepResult as any;
          if (stepRes.status === 'suspended') {
            const nestedPath = stepRes.suspendPayload?.__workflow_meta?.path;
            if (nestedPath && Array.isArray(nestedPath)) {
              // For nested workflows, combine the parent step ID with the nested path
              suspendedStepPaths.push([stepId, ...nestedPath]);
            } else {
              // For single-level suspension, just use the step ID
              suspendedStepPaths.push([stepId]);
            }
          }
        }
      });

      if (suspendedStepPaths.length === 0) {
        throw new Error('No suspended steps found in this workflow run');
      }

      if (suspendedStepPaths.length === 1) {
        // For single suspended step, use the full path
        steps = suspendedStepPaths[0]!;
      } else {
        const pathStrings = suspendedStepPaths.map(path => `[${path.join(', ')}]`);
        throw new Error(
          `Multiple suspended steps found: ${pathStrings.join(', ')}. ` +
            'Please specify which step to resume using the "step" parameter.',
        );
      }
    }

    if (!params.runCount) {
      if (snapshot.status !== 'suspended') {
        throw new Error('This workflow run was not suspended');
      }

      const suspendedStepIds = Object.keys(snapshot?.suspendedPaths ?? {});

      const isStepSuspended = suspendedStepIds.includes(steps?.[0] ?? '');

      if (!isStepSuspended) {
        throw new Error(
          `This workflow step "${steps?.[0]}" was not suspended. Available suspended steps: [${suspendedStepIds.join(', ')}]`,
        );
      }
    }

    let runtimeContextInput;
    if (params.runCount && params.runCount > 0 && params.runtimeContext) {
      runtimeContextInput = params.runtimeContext.get('__mastraWorflowInputData');
      params.runtimeContext.delete('__mastraWorflowInputData');
    }

    const stepResults = { ...(snapshot?.context ?? {}), input: runtimeContextInput ?? snapshot?.context?.input } as any;

    let runtimeContextToUse = params.runtimeContext ?? new RuntimeContext();

    Object.entries(snapshot?.runtimeContext ?? {}).forEach(([key, value]) => {
      if (!runtimeContextToUse.has(key)) {
        runtimeContextToUse.set(key, value);
      }
    });

    // note: this span is ended inside this.executionEngine.execute()
    const workflowAISpan = getOrCreateSpan({
      type: AISpanType.WORKFLOW_RUN,
      name: `workflow run: '${this.workflowId}'`,
      input: params.resumeData,
      attributes: {
        workflowId: this.workflowId,
      },
      tracingPolicy: this.tracingPolicy,
      tracingOptions: params.tracingOptions,
      tracingContext: params.tracingContext,
      runtimeContext: runtimeContextToUse,
    });

    const traceId = getValidTraceId(workflowAISpan);

    const executionResultPromise = this.executionEngine
      .execute<z.infer<TInput>, WorkflowResult<TOutput, TSteps>>({
        workflowId: this.workflowId,
        runId: this.runId,
        graph: this.executionGraph,
        serializedStepGraph: this.serializedStepGraph,
        input: snapshot?.context?.input,
        resume: {
          steps,
          stepResults,
          resumePayload: params.resumeData,
          // @ts-ignore
          resumePath: snapshot?.suspendedPaths?.[steps?.[0]] as any,
        },
        format: params.format,
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
        runtimeContext: runtimeContextToUse,
        abortController: this.abortController,
        workflowAISpan,
      })
      .then(result => {
        if (!params.isVNext && result.status !== 'suspended') {
          this.closeStreamAction?.().catch(() => {});
        }
        result.traceId = traceId;
        return result;
      });

    this.executionResults = executionResultPromise;

    return executionResultPromise;
  }

  /**
   * Returns the current state of the workflow run
   * @returns The current state of the workflow run
   */
  getState(): Record<string, any> {
    return this.state;
  }

  updateState(state: Record<string, any>) {
    if (state.currentStep) {
      this.state.currentStep = state.currentStep;
    } else if (state.workflowState?.status !== 'running') {
      delete this.state.currentStep;
    }

    if (state.workflowState) {
      this.state.workflowState = deepMergeWorkflowState(this.state.workflowState ?? {}, state.workflowState ?? {});
    }
  }

  /**
   * @access private
   * @returns The execution results of the workflow run
   */
  _getExecutionResults(): Promise<WorkflowResult<TOutput, TSteps>> | undefined {
    return this.executionResults;
  }
}

function deepMergeWorkflowState(a: Record<string, any>, b: Record<string, any>): Record<string, any> {
  if (!a || typeof a !== 'object') return b;
  if (!b || typeof b !== 'object') return a;

  const result = { ...a };

  for (const key in b) {
    if (b[key] === undefined) continue;

    if (b[key] !== null && typeof b[key] === 'object') {
      const aVal = result[key];
      const bVal = b[key];

      if (Array.isArray(bVal)) {
        //we should just replace it instead of spreading as we do for others
        //spreading aVal and then bVal will result in duplication of items
        result[key] = bVal.filter(item => item !== undefined);
      } else if (typeof aVal === 'object' && aVal !== null) {
        // If both values are objects, merge them
        result[key] = deepMergeWorkflowState(aVal, bVal);
      } else {
        // If the target isn't an object, use the source object
        result[key] = bVal;
      }
    } else {
      result[key] = b[key];
    }
  }

  return result;
}
