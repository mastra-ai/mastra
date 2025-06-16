import { randomUUID } from 'crypto';
import EventEmitter from 'events';
import { z } from 'zod';
import type { Mastra, WorkflowRun } from '..';
import type { MastraPrimitives } from '../action';
import { Agent } from '../agent';
import { MastraBase } from '../base';
import { RuntimeContext } from '../di';
import { RegisteredLogger } from '../logger';
import { Tool } from '../tools';
import type { ToolExecutionContext } from '../tools/types';
import { EMITTER_SYMBOL } from './constants';
import { DefaultExecutionEngine } from './default';
import type { ExecutionEngine, ExecutionGraph } from './execution-engine';
import type { ExecuteFunction, Step } from './step';
import type {
  StepsRecord,
  StepResult,
  WatchEvent,
  ExtractSchemaType,
  ExtractSchemaFromStep,
  PathsToStringProps,
  ZodPathType,
  DynamicMapping,
  StreamEvent,
  WorkflowRunState,
} from './types';

export type DefaultEngineType = {};

export type StepFlowEntry<TEngineType = DefaultEngineType> =
  | { type: 'step'; step: Step }
  | { type: 'sleep'; id: string; duration: number }
  | { type: 'sleepUntil'; id: string; date: Date }
  | { type: 'waitForEvent'; event: string; step: Step; timeout?: number }
  | {
      type: 'parallel';
      steps: StepFlowEntry[];
    }
  | {
      type: 'conditional';
      steps: StepFlowEntry[];
      conditions: ExecuteFunction<any, any, any, any, TEngineType>[];
      serializedConditions: { id: string; fn: string }[];
    }
  | {
      type: 'loop';
      step: Step;
      condition: ExecuteFunction<any, any, any, any, TEngineType>;
      serializedCondition: { id: string; fn: string };
      loopType: 'dowhile' | 'dountil';
    }
  | {
      type: 'foreach';
      step: Step;
      opts: {
        concurrency: number;
      };
    };

export type SerializedStep<TEngineType = DefaultEngineType> = Pick<
  Step<any, any, any, any, any, TEngineType>,
  'id' | 'description'
> & {
  component?: string;
  serializedStepFlow?: SerializedStepFlowEntry[];
  mapConfig?: string;
};

export type SerializedStepFlowEntry =
  | {
      type: 'step';
      step: SerializedStep;
    }
  | {
      type: 'sleep';
      id: string;
      duration: number;
    }
  | {
      type: 'sleepUntil';
      id: string;
      date: Date;
    }
  | {
      type: 'waitForEvent';
      event: string;
      step: SerializedStep;
      timeout?: number;
    }
  | {
      type: 'parallel';
      steps: SerializedStepFlowEntry[];
    }
  | {
      type: 'conditional';
      steps: SerializedStepFlowEntry[];
      serializedConditions: { id: string; fn: string }[];
    }
  | {
      type: 'loop';
      step: SerializedStep;
      serializedCondition: { id: string; fn: string };
      loopType: 'dowhile' | 'dountil';
    }
  | {
      type: 'foreach';
      step: SerializedStep;
      opts: {
        concurrency: number;
      };
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
    DefaultEngineType
  >;
}): Step<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, DefaultEngineType>;

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
  tool: Tool<TSchemaIn, TSchemaOut, TContext> & {
    inputSchema: TSchemaIn;
    outputSchema: TSchemaOut;
    execute: (context: TContext) => Promise<any>;
  },
): Step<string, TSchemaIn, TSchemaOut, z.ZodType<any>, z.ZodType<any>, DefaultEngineType>;

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
          DefaultEngineType
        >;
      }
    | Agent<any, any, any>
    | (Tool<TStepInput, TStepOutput, any> & {
        inputSchema: TStepInput;
        outputSchema: TStepOutput;
        execute: (context: ToolExecutionContext<TStepInput>) => Promise<any>;
      }),
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
      execute: async ({ inputData, [EMITTER_SYMBOL]: emitter, runtimeContext }) => {
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
        });

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
>(
  workflow: Workflow<DefaultEngineType, TSteps, string, TInput, TOutput, TInput>,
  opts: { id: TWorkflowId },
): Workflow<DefaultEngineType, TSteps, TWorkflowId, TInput, TOutput, TInput> {
  const wf = new Workflow({
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

export type WorkflowResult<TOutput extends z.ZodType<any>, TSteps extends Step<string, any, any>[]> =
  | {
      status: 'success';
      result: z.infer<TOutput>;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              z.infer<NonNullable<StepsRecord<TSteps>[K]['inputSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['resumeSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['suspendSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>
            >;
      };
    }
  | {
      status: 'failed';
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              z.infer<NonNullable<StepsRecord<TSteps>[K]['inputSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['resumeSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['suspendSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>
            >;
      };
      error: Error;
    }
  | {
      status: 'suspended';
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              z.infer<NonNullable<StepsRecord<TSteps>[K]['inputSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['resumeSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['suspendSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>
            >;
      };
      suspended: [string[], ...string[][]];
    };

export type WorkflowConfig<
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[] = Step<string, any, any, any, any, any>[],
> = {
  mastra?: Mastra;
  id: TWorkflowId;
  description?: string | undefined;
  inputSchema: TInput;
  outputSchema: TOutput;
  executionEngine?: ExecutionEngine;
  steps?: TSteps;
  retryConfig?: {
    attempts?: number;
    delay?: number;
  };
};

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
  public steps: Record<string, Step<string, any, any, any, any>>;
  public stepDefs?: TSteps;
  protected stepFlow: StepFlowEntry[];
  protected serializedStepFlow: SerializedStepFlowEntry[];
  protected executionEngine: ExecutionEngine;
  protected executionGraph: ExecutionGraph;
  protected retryConfig: {
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

    if (!executionEngine) {
      // TODO: this should be configured using the Mastra class instance that's passed in
      this.executionEngine = new DefaultExecutionEngine({ mastra: this.#mastra });
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

  setStepFlow(stepFlow: StepFlowEntry[]) {
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
  sleep(duration: number) {
    const id = `sleep_${randomUUID()}`;
    this.stepFlow.push({ type: 'sleep', id, duration });
    this.serializedStepFlow.push({
      type: 'sleep',
      id,
      duration,
    });
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
  sleepUntil(date: Date) {
    const id = `sleep_${randomUUID()}`;
    this.stepFlow.push({ type: 'sleepUntil', id, date });
    this.serializedStepFlow.push({
      type: 'sleepUntil',
      id,
      date,
    });
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

  map<
    TSteps extends Step<string, any, any, any, any, TEngineType>[],
    TMapping extends {
      [K in keyof TMapping]:
        | {
            step: TSteps[number] | TSteps[number][];
            path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TSteps[number], 'outputSchema'>>> | '.';
          }
        | { value: any; schema: z.ZodTypeAny }
        | {
            initData: TSteps[number];
            path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TSteps[number], 'inputSchema'>>> | '.';
          }
        | {
            runtimeContextPath: string;
            schema: z.ZodTypeAny;
          }
        | DynamicMapping<TPrevSchema, z.ZodTypeAny>;
    },
  >(mappingConfig: TMapping | ExecuteFunction<z.infer<TPrevSchema>, any, any, any, TEngineType>) {
    // Create an implicit step that handles the mapping
    if (typeof mappingConfig === 'function') {
      // @ts-ignore
      const mappingStep: any = createStep({
        id: `mapping_${randomUUID()}`,
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
      id: `mapping_${randomUUID()}`,
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
              throw new Error(`Invalid path ${m.path} in step ${m.step.id}`);
            }
          }

          result[key] = value;
        }
        return result as z.infer<typeof mappingStep.outputSchema>;
      },
    });

    type MappedOutputSchema = z.ZodObject<
      {
        [K in keyof TMapping]: TMapping[K] extends {
          step: TSteps[number];
          path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TSteps[number], 'outputSchema'>>>;
        }
          ? TMapping[K]['path'] extends '.'
            ? TMapping[K]['step']['outputSchema']
            : ZodPathType<TMapping[K]['step']['outputSchema'], TMapping[K]['path']>
          : TMapping[K] extends {
                initData: TSteps[number];
                path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TSteps[number], 'inputSchema'>>>;
              }
            ? TMapping[K]['path'] extends '.'
              ? TMapping[K]['initData']['inputSchema']
              : ZodPathType<TMapping[K]['initData']['inputSchema'], TMapping[K]['path']>
            : TMapping[K] extends { schema: z.ZodTypeAny }
              ? TMapping[K]['schema']
              : TMapping[K] extends { runtimeContextPath: string; schema: z.ZodTypeAny }
                ? TMapping[K]['schema']
                : never;
      },
      any,
      z.ZodTypeAny
    >;

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
   * Creates a new workflow run instance
   * @param options Optional configuration for the run
   * @returns A Run instance that can be used to execute the workflow
   */
  createRun(options?: { runId?: string }): Run<TEngineType, TSteps, TInput, TOutput> {
    if (this.stepFlow.length === 0) {
      throw new Error(
        'Execution flow of workflow is not defined. Add steps to the workflow via .then(), .branch(), etc.',
      );
    }
    if (!this.executionGraph.steps) {
      throw new Error('Uncommitted step flow changes detected. Call .commit() to register the steps.');
    }
    const runIdToUse = options?.runId || randomUUID();

    // Return a new Run instance with object parameters
    const run =
      this.#runs.get(runIdToUse) ??
      new Run({
        workflowId: this.id,
        runId: runIdToUse,
        executionEngine: this.executionEngine,
        executionGraph: this.executionGraph,
        mastra: this.#mastra,
        retryConfig: this.retryConfig,
        serializedStepGraph: this.serializedStepGraph,
        cleanup: () => this.#runs.delete(runIdToUse),
      });

    this.#runs.set(runIdToUse, run);

    return run;
  }

  async execute({
    inputData,
    resumeData,
    suspend,
    resume,
    [EMITTER_SYMBOL]: emitter,
    mastra,
    runtimeContext,
  }: {
    inputData: z.infer<TInput>;
    resumeData?: any;
    getStepResult<T extends Step<any, any, any, any, any, TEngineType>>(
      stepId: T,
    ): T['outputSchema'] extends undefined ? unknown : z.infer<NonNullable<T['outputSchema']>>;
    suspend: (suspendPayload: any) => Promise<void>;
    resume?: {
      steps: string[];
      resumePayload: any;
      runId?: string;
    };
    [EMITTER_SYMBOL]: { emit: (event: string, data: any) => void };
    mastra: Mastra;
    runtimeContext?: RuntimeContext;
    engine: DefaultEngineType;
  }): Promise<z.infer<TOutput>> {
    this.__registerMastra(mastra);

    const run = resume?.steps?.length ? this.createRun({ runId: resume.runId }) : this.createRun();
    const unwatch = run.watch(event => {
      emitter.emit('nested-watch', { event, workflowId: this.id, runId: run.runId, isResume: !!resume?.steps?.length });
    });
    const res = resume?.steps?.length
      ? await run.resume({ resumeData, step: resume.steps as any, runtimeContext })
      : await run.start({ inputData, runtimeContext });
    unwatch();
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

  async getWorkflowRunExecutionResult(runId: string): Promise<WatchEvent['payload']['workflowState'] | null> {
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

    return {
      status: (snapshot as WorkflowRunState).status,
      result: (snapshot as WorkflowRunState).result,
      error: (snapshot as WorkflowRunState).error,
      payload: (snapshot as WorkflowRunState).context?.input,
      steps: (snapshot as WorkflowRunState).context as any,
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

  protected closeStreamAction?: () => Promise<void>;
  protected executionResults?: Promise<WorkflowResult<TOutput, TSteps>>;

  protected cleanup?: () => void;

  protected retryConfig?: {
    attempts?: number;
    delay?: number;
  };

  constructor(params: {
    workflowId: string;
    runId: string;
    executionEngine: ExecutionEngine;
    executionGraph: ExecutionGraph;
    mastra?: Mastra;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    cleanup?: () => void;
    serializedStepGraph: SerializedStepFlowEntry[];
  }) {
    this.workflowId = params.workflowId;
    this.runId = params.runId;
    this.serializedStepGraph = params.serializedStepGraph;
    this.executionEngine = params.executionEngine;
    this.executionGraph = params.executionGraph;
    this.#mastra = params.mastra;
    this.emitter = new EventEmitter();
    this.retryConfig = params.retryConfig;
    this.cleanup = params.cleanup;
  }

  sendEvent(event: string, data: any) {
    this.emitter.emit(`user-event-${event}`, data);
  }

  /**
   * Starts the workflow execution with the provided input
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  async start({
    inputData,
    runtimeContext,
  }: {
    inputData?: z.infer<TInput>;
    runtimeContext?: RuntimeContext;
  }): Promise<WorkflowResult<TOutput, TSteps>> {
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
    });

    this.cleanup?.();

    return result;
  }

  /**
   * Starts the workflow execution with the provided input as a stream
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  stream({ inputData, runtimeContext }: { inputData?: z.infer<TInput>; runtimeContext?: RuntimeContext } = {}): {
    stream: ReadableStream<StreamEvent>;
    getWorkflowState: () => Promise<WorkflowResult<TOutput, TSteps>>;
  } {
    const { readable, writable } = new TransformStream<StreamEvent, StreamEvent>();

    const writer = writable.getWriter();
    const unwatch = this.watch(async event => {
      try {
        // watch-v2 events are data stream events, so we need to cast them to the correct type
        await writer.write(event as any);
      } catch {}
    }, 'watch-v2');

    this.closeStreamAction = async () => {
      this.emitter.emit('watch-v2', {
        type: 'finish',
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

    this.emitter.emit('watch-v2', {
      type: 'start',
      payload: { runId: this.runId },
    });
    this.executionResults = this.start({ inputData, runtimeContext }).then(result => {
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

  watch(cb: (event: WatchEvent) => void, type: 'watch' | 'watch-v2' = 'watch'): () => void {
    const watchCb = (event: WatchEvent) => {
      this.updateState(event.payload);

      if (type !== 'watch-v2') {
        cb({ type: event.type, payload: this.getState() as any, eventTimestamp: event.eventTimestamp });
      }
    };

    this.emitter.on('watch', watchCb);
    if (type === 'watch-v2') {
      this.emitter.on('watch-v2', cb);
    }

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
    this.emitter.on('nested-watch', nestedWatchCb);

    return () => {
      if (type === 'watch-v2') {
        this.emitter.off('watch-v2', cb);
      }

      this.emitter.off('watch', watchCb);
      this.emitter.off('nested-watch', nestedWatchCb);
    };
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
    const snapshot = await this.#mastra?.getStorage()?.loadWorkflowSnapshot({
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
