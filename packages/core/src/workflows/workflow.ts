import EventEmitter from 'events';
import { randomUUID } from 'node:crypto';
import { WritableStream, ReadableStream, TransformStream } from 'stream/web';
import { z } from 'zod';
import type { MastraPrimitives } from '../action';
import { Agent } from '../agent';
import type { AgentExecutionOptions, AgentStreamOptions } from '../agent';
import { MastraBase } from '../base';
import { RequestContext } from '../di';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { MastraScorers } from '../evals';
import { RegisteredLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { TracingContext, TracingOptions, TracingPolicy } from '../observability';
import { SpanType, getOrCreateSpan } from '../observability';
import type { StorageListWorkflowRunsInput, WorkflowRun } from '../storage';
import { WorkflowRunOutput } from '../stream/RunOutput';
import type { ChunkType } from '../stream/types';
import { ChunkFrom } from '../stream/types';
import { Tool } from '../tools';
import type { ToolExecutionContext } from '../tools/types';
import { EMITTER_SYMBOL, STREAM_FORMAT_SYMBOL } from './constants';
import { DefaultExecutionEngine } from './default';
import type { ExecutionEngine, ExecutionGraph } from './execution-engine';
import type { ConditionFunction, ExecuteFunction, LoopConditionFunction, Step, SuspendOptions } from './step';
import type {
  DefaultEngineType,
  DynamicMapping,
  ExtractSchemaFromStep,
  ExtractSchemaType,
  RestartExecutionParams,
  PathsToStringProps,
  SerializedStep,
  SerializedStepFlowEntry,
  StepFlowEntry,
  StepResult,
  StepsRecord,
  StepWithComponent,
  StreamEvent,
  SubsetOf,
  TimeTravelContext,
  WorkflowConfig,
  WorkflowEngineType,
  WorkflowOptions,
  WorkflowResult,
  WorkflowRunState,
  WorkflowRunStatus,
  WorkflowState,
  WorkflowStreamEvent,
  ToolStep,
  StepParams,
} from './types';
import { createTimeTravelExecutionParams, getZodErrors } from './utils';

// Options that can be passed when wrapping an agent with createStep
// These work for both stream() (v2) and streamLegacy() (v1) methods
export type AgentStepOptions = Omit<
  AgentExecutionOptions & AgentStreamOptions,
  | 'format'
  | 'tracingContext'
  | 'requestContext'
  | 'abortSignal'
  | 'context'
  | 'onStepFinish'
  | 'output'
  | 'experimental_output'
  | 'resourceId'
  | 'threadId'
>;

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
  TState extends z.ZodObject<any>,
  TStepInput extends z.ZodType<any>,
  TStepOutput extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(
  params: StepParams<TStepId, TState, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema>,
): Step<TStepId, TState, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, DefaultEngineType>;

export function createStep<
  TStepId extends string,
  TStepInput extends z.ZodObject<{ prompt: z.ZodString }>,
  TStepOutput extends z.ZodObject<{ text: z.ZodString }>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(
  agent: Agent<TStepId, any>,
  agentOptions?: AgentStepOptions,
): Step<TStepId, any, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, DefaultEngineType>;

export function createStep<
  TSchemaIn extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
  TContext extends ToolExecutionContext<TSuspendSchema, TResumeSchema>,
>(
  tool: ToolStep<TSchemaIn, TSuspendSchema, TResumeSchema, TSchemaOut, TContext>,
): Step<string, any, TSchemaIn, TSchemaOut, z.ZodType<any>, z.ZodType<any>, DefaultEngineType>;

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
): Step<TStepId, TState, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, DefaultEngineType> {
  if (params instanceof Agent) {
    return {
      id: params.name,
      description: params.getDescription(),
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

  if (params instanceof Tool) {
    if (!params.inputSchema || !params.outputSchema) {
      throw new Error('Tool must have input and output schemas defined');
    }

    return {
      // TODO: tool probably should have strong id type
      // @ts-ignore
      id: params.id,
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
          suspend,
          resumeData,
          workflow: {
            runId,
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
    id: params.id,
    description: params.description,
    inputSchema: params.inputSchema,
    stateSchema: params.stateSchema,
    outputSchema: params.outputSchema,
    resumeSchema: params.resumeSchema,
    suspendSchema: params.suspendSchema,
    scorers: params.scorers,
    retries: params.retries,
    execute: params.execute.bind(params),
  };
}

export function cloneStep<TStepId extends string>(
  step: Step<string, any, any, any, any, any, DefaultEngineType>,
  opts: { id: TStepId },
): Step<TStepId, any, any, any, any, any, DefaultEngineType> {
  return {
    id: opts.id,
    description: step.description,
    inputSchema: step.inputSchema,
    outputSchema: step.outputSchema,
    suspendSchema: step.suspendSchema,
    resumeSchema: step.resumeSchema,
    stateSchema: step.stateSchema,
    execute: step.execute,
    retries: step.retries,
    scorers: step.scorers,
    component: step.component,
  };
}

export function createWorkflow<
  TWorkflowId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any, DefaultEngineType>[] = Step<
    string,
    any,
    any,
    any,
    any,
    any,
    DefaultEngineType
  >[],
>(params: WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>) {
  return new Workflow<DefaultEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TInput>(params);
}

export function cloneWorkflow<
  TWorkflowId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any, DefaultEngineType>[] = Step<
    string,
    any,
    any,
    any,
    any,
    any,
    DefaultEngineType
  >[],
  TPrevSchema extends z.ZodType<any> = TInput,
>(
  workflow: Workflow<DefaultEngineType, TSteps, string, TState, TInput, TOutput, TPrevSchema>,
  opts: { id: TWorkflowId },
): Workflow<DefaultEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> {
  const wf: Workflow<DefaultEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> = new Workflow({
    id: opts.id,
    inputSchema: workflow.inputSchema,
    outputSchema: workflow.outputSchema,
    steps: workflow.stepDefs,
    mastra: workflow.mastra,
    options: workflow.options,
  });

  wf.setStepFlow(workflow.stepGraph);
  wf.commit();
  return wf;
}

export class Workflow<
    TEngineType = any,
    TSteps extends Step<string, any, any, any, any, any, TEngineType>[] = Step<
      string,
      any,
      any,
      any,
      any,
      any,
      TEngineType
    >[],
    TWorkflowId extends string = string,
    TState extends z.ZodObject<any> = z.ZodObject<any>,
    TInput extends z.ZodType<any> = z.ZodType<any>,
    TOutput extends z.ZodType<any> = z.ZodType<any>,
    TPrevSchema extends z.ZodType<any> = TInput,
  >
  extends MastraBase
  implements Step<TWorkflowId, TState, TInput, TOutput, any, any, DefaultEngineType>
{
  public id: TWorkflowId;
  public description?: string | undefined;
  public inputSchema: TInput;
  public outputSchema: TOutput;
  public stateSchema?: TState;
  public steps: Record<string, StepWithComponent>;
  public stepDefs?: TSteps;
  public engineType: WorkflowEngineType = 'default';
  #nestedWorkflowInput?: z.infer<TInput>;
  public committed: boolean = false;
  protected stepFlow: StepFlowEntry<TEngineType>[];
  protected serializedStepFlow: SerializedStepFlowEntry[];
  protected executionEngine: ExecutionEngine;
  protected executionGraph: ExecutionGraph;
  #options: Omit<WorkflowOptions, 'shouldPersistSnapshot' | 'validateInputs'> &
    Required<Pick<WorkflowOptions, 'shouldPersistSnapshot' | 'validateInputs'>>;
  public retryConfig: {
    attempts?: number;
    delay?: number;
  };

  #mastra?: Mastra;

  #runs: Map<string, Run<TEngineType, TSteps, TState, TInput, TOutput>> = new Map();

  constructor({
    mastra,
    id,
    inputSchema,
    outputSchema,
    stateSchema,
    description,
    executionEngine,
    retryConfig,
    steps,
    options = {},
  }: WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>) {
    super({ name: id, component: RegisteredLogger.WORKFLOW });
    this.id = id;
    this.description = description;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
    this.stateSchema = stateSchema;
    this.retryConfig = retryConfig ?? { attempts: 0, delay: 0 };
    this.executionGraph = this.buildExecutionGraph();
    this.stepFlow = [];
    this.serializedStepFlow = [];
    this.#mastra = mastra;
    this.steps = {};
    this.stepDefs = steps;
    this.#options = {
      validateInputs: options.validateInputs ?? true,
      shouldPersistSnapshot: options.shouldPersistSnapshot ?? (() => true),
      tracingPolicy: options.tracingPolicy,
    };

    if (!executionEngine) {
      // TODO: this should be configured using the Mastra class instance that's passed in
      this.executionEngine = new DefaultExecutionEngine({
        mastra: this.#mastra,
        options: this.#options,
      });
    } else {
      this.executionEngine = executionEngine;
    }

    this.engineType = 'default';

    this.#runs = new Map();
  }

  get runs() {
    return this.#runs;
  }

  get mastra() {
    return this.#mastra;
  }

  get options() {
    return this.#options;
  }

  __registerMastra(mastra: Mastra) {
    this.#mastra = mastra;
    this.executionEngine.__registerMastra(mastra);
  }

  __registerPrimitives(p: MastraPrimitives) {
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
  then<TStepId extends string, TStepState extends z.ZodObject<any>, TSchemaOut extends z.ZodType<any>>(
    step: Step<TStepId, SubsetOf<TStepState, TState>, TPrevSchema, TSchemaOut, any, any, TEngineType>,
  ) {
    this.stepFlow.push({ type: 'step', step: step as any });
    this.serializedStepFlow.push({
      type: 'step',
      step: {
        id: step.id,
        description: step.description,
        component: (step as SerializedStep).component,
        serializedStepFlow: (step as SerializedStep).serializedStepFlow,
        canSuspend: Boolean(step.suspendSchema || step.resumeSchema),
      },
    });
    this.steps[step.id] = step;
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TSchemaOut>;
  }

  /**
   * Adds a sleep step to the workflow
   * @param duration The duration to sleep for
   * @returns The workflow instance for chaining
   */
  sleep(duration: number | ExecuteFunction<z.infer<TState>, z.infer<TPrevSchema>, number, any, any, TEngineType>) {
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
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema>;
  }

  /**
   * Adds a sleep until step to the workflow
   * @param date The date to sleep until
   * @returns The workflow instance for chaining
   */
  sleepUntil(date: Date | ExecuteFunction<z.infer<TState>, z.infer<TPrevSchema>, Date, any, any, TEngineType>) {
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
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema>;
  }

  /**
   * @deprecated waitForEvent has been removed. Please use suspend/resume instead.
   */
  waitForEvent<
    TStepState extends z.ZodObject<any>,
    TStepInputSchema extends TPrevSchema,
    TStepId extends string,
    TSchemaOut extends z.ZodType<any>,
  >(
    _event: string,
    _step: Step<TStepId, SubsetOf<TStepState, TState>, TStepInputSchema, TSchemaOut, any, any, TEngineType>,
    _opts?: {
      timeout?: number;
    },
  ) {
    throw new MastraError({
      id: 'WORKFLOW_WAIT_FOR_EVENT_REMOVED',
      domain: ErrorDomain.MASTRA_WORKFLOW,
      category: ErrorCategory.USER,
      text: 'waitForEvent has been removed. Please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details.',
    });
  }

  map(
    mappingConfig:
      | {
          [k: string]:
            | {
                step:
                  | Step<string, any, any, any, any, any, TEngineType>
                  | Step<string, any, any, any, any, any, TEngineType>[];
                path: string;
              }
            | { value: any; schema: z.ZodType<any> }
            | {
                initData: Workflow<TEngineType, any, any, any, any, any, any>;
                path: string;
              }
            | {
                requestContextPath: string;
                schema: z.ZodType<any>;
              }
            | DynamicMapping<TPrevSchema, z.ZodType<any>>;
        }
      | ExecuteFunction<z.infer<TState>, z.infer<TPrevSchema>, any, any, any, TEngineType>,
    stepOptions?: { id?: string | null },
  ): Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, any> {
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
      return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, any>;
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
        } else if (m.requestContextPath) {
          a[key] = {
            requestContextPath: m.requestContextPath,
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
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ctx => {
        const { getStepResult, getInitData, requestContext } = ctx;

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

          if (m.requestContextPath) {
            result[key] = requestContext.get(m.requestContextPath);
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
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, MappedOutputSchema>;
  }

  // TODO: make typing better here
  parallel<TParallelSteps extends readonly Step<string, any, TPrevSchema, any, any, any, TEngineType>[]>(
    steps: TParallelSteps & {
      [K in keyof TParallelSteps]: TParallelSteps[K] extends Step<
        string,
        infer S extends z.ZodObject<any>,
        TPrevSchema,
        infer O,
        infer R,
        infer E,
        TEngineType
      >
        ? Step<string, SubsetOf<S, TState>, TPrevSchema, O, R, E, TEngineType>
        : `Error: Expected Step with state schema that is a subset of workflow state`;
    },
  ) {
    this.stepFlow.push({ type: 'parallel', steps: steps.map(step => ({ type: 'step', step: step as any })) });
    this.serializedStepFlow.push({
      type: 'parallel',
      steps: steps.map((step: any) => ({
        type: 'step',
        step: {
          id: step.id,
          description: step.description,
          component: (step as SerializedStep).component,
          serializedStepFlow: (step as SerializedStep).serializedStepFlow,
          canSuspend: Boolean(step.suspendSchema || step.resumeSchema),
        },
      })),
    });
    steps.forEach((step: any) => {
      this.steps[step.id] = step;
    });
    return this as unknown as Workflow<
      TEngineType,
      TSteps,
      TWorkflowId,
      TState,
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
  // TODO: add state schema to the type, this is currently broken
  branch<
    TBranchSteps extends Array<
      [
        ConditionFunction<z.infer<TState>, z.infer<TPrevSchema>, any, any, TEngineType>,
        Step<string, any, TPrevSchema, any, any, any, TEngineType>,
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
          canSuspend: Boolean(step.suspendSchema || step.resumeSchema),
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
      TState,
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

  dowhile<
    TStepState extends z.ZodObject<any>,
    TStepInputSchema extends TPrevSchema,
    TStepId extends string,
    TSchemaOut extends z.ZodType<any>,
  >(
    step: Step<TStepId, SubsetOf<TStepState, TState>, TStepInputSchema, TSchemaOut, any, any, TEngineType>,
    condition: LoopConditionFunction<z.infer<TState>, any, any, any, TEngineType>,
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
        canSuspend: Boolean(step.suspendSchema || step.resumeSchema),
      },
      serializedCondition: { id: `${step.id}-condition`, fn: condition.toString() },
      loopType: 'dowhile',
    });
    this.steps[step.id] = step;
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TSchemaOut>;
  }

  dountil<
    TStepState extends z.ZodObject<any>,
    TStepInputSchema extends TPrevSchema,
    TStepId extends string,
    TSchemaOut extends z.ZodType<any>,
  >(
    step: Step<TStepId, SubsetOf<TStepState, TState>, TStepInputSchema, TSchemaOut, any, any, TEngineType>,
    condition: LoopConditionFunction<z.infer<TState>, any, any, any, TEngineType>,
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
        canSuspend: Boolean(step.suspendSchema || step.resumeSchema),
      },
      serializedCondition: { id: `${step.id}-condition`, fn: condition.toString() },
      loopType: 'dountil',
    });
    this.steps[step.id] = step;
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TSchemaOut>;
  }

  foreach<
    TPrevIsArray extends TPrevSchema extends z.ZodArray<any> ? true : false,
    TStepState extends z.ZodObject<any>,
    TStepInputSchema extends TPrevSchema extends z.ZodArray<infer TElement> ? TElement : never,
    TStepId extends string,
    TSchemaOut extends z.ZodType<any>,
  >(
    step: TPrevIsArray extends true
      ? Step<TStepId, SubsetOf<TStepState, TState>, TStepInputSchema, TSchemaOut, any, any, TEngineType>
      : 'Previous step must return an array type',
    opts?: {
      concurrency: number;
    },
  ) {
    const actualStep = step as Step<any, any, any, any, any, any>;
    this.stepFlow.push({ type: 'foreach', step: step as any, opts: opts ?? { concurrency: 1 } });
    this.serializedStepFlow.push({
      type: 'foreach',
      step: {
        id: (step as SerializedStep).id,
        description: (step as SerializedStep).description,
        component: (step as SerializedStep).component,
        serializedStepFlow: (step as SerializedStep).serializedStepFlow,
        canSuspend: Boolean(actualStep.suspendSchema || actualStep.resumeSchema),
      },
      opts: opts ?? { concurrency: 1 },
    });
    this.steps[(step as any).id] = step as any;
    return this as unknown as Workflow<
      TEngineType,
      TSteps,
      TWorkflowId,
      TState,
      TInput,
      TOutput,
      z.ZodArray<TSchemaOut>
    >;
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
    this.committed = true;
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TOutput>;
  }

  get stepGraph() {
    return this.stepFlow;
  }

  get serializedStepGraph() {
    return this.serializedStepFlow;
  }

  /**
   * Creates a new workflow run instance and stores a snapshot of the workflow in the storage
   * @param options Optional configuration for the run
   * @param options.runId Optional custom run ID, defaults to a random UUID
   * @param options.resourceId Optional resource ID to associate with this run
   * @param options.disableScorers Optional flag to disable scorers for this run
   * @returns A Run instance that can be used to execute the workflow
   */
  async createRun(options?: {
    runId?: string;
    resourceId?: string;
    disableScorers?: boolean;
  }): Promise<Run<TEngineType, TSteps, TState, TInput, TOutput>> {
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
        stateSchema: this.stateSchema,
        runId: runIdToUse,
        resourceId: options?.resourceId,
        executionEngine: this.executionEngine,
        executionGraph: this.executionGraph,
        mastra: this.#mastra,
        retryConfig: this.retryConfig,
        serializedStepGraph: this.serializedStepGraph,
        disableScorers: options?.disableScorers,
        cleanup: () => this.#runs.delete(runIdToUse),
        tracingPolicy: this.#options?.tracingPolicy,
        workflowSteps: this.steps,
        validateInputs: this.#options?.validateInputs,
        workflowEngineType: this.engineType,
      });

    this.#runs.set(runIdToUse, run);

    const shouldPersistSnapshot = this.#options.shouldPersistSnapshot({
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
          context: this.#nestedWorkflowInput ? { input: this.#nestedWorkflowInput } : {},
          activePaths: [],
          activeStepsPath: {},
          serializedStepGraph: this.serializedStepGraph,
          suspendedPaths: {},
          resumeLabels: {},
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

  async listScorers({
    requestContext = new RequestContext(),
  }: { requestContext?: RequestContext } = {}): Promise<MastraScorers> {
    const steps = this.steps;

    if (!steps || Object.keys(steps).length === 0) {
      return {};
    }

    const scorers: MastraScorers = {};

    for (const step of Object.values(steps)) {
      if (step.scorers) {
        let scorersToUse = step.scorers;

        if (typeof scorersToUse === 'function') {
          scorersToUse = await scorersToUse({ requestContext });
        }

        for (const [id, scorer] of Object.entries(scorersToUse)) {
          scorers[id] = scorer;
        }
      }
    }

    return scorers;
  }

  // This method should only be called internally for nested workflow execution, as well as from mastra server handlers
  // To run a workflow use `.createRun` and then `.start` or `.resume`
  async execute({
    runId,
    inputData,
    resumeData,
    state,
    setState,
    suspend,
    restart,
    resume,
    timeTravel,
    [EMITTER_SYMBOL]: emitter,
    mastra,
    requestContext,
    abort,
    abortSignal,
    retryCount,
    tracingContext,
    writer,
    validateInputs,
  }: {
    runId?: string;
    inputData: z.infer<TInput>;
    resumeData?: any;
    state: z.infer<TState>;
    setState: (state: z.infer<TState>) => void;
    getStepResult<T extends Step<any, any, any, any, any, any, TEngineType>>(
      stepId: T,
    ): T['outputSchema'] extends undefined ? unknown : z.infer<NonNullable<T['outputSchema']>>;
    suspend: (suspendPayload: any, suspendOptions?: SuspendOptions) => Promise<any>;
    restart?: boolean;
    timeTravel?: {
      inputData?: z.infer<TInput>;
      steps: string[];
      nestedStepResults?: Record<string, Record<string, StepResult<any, any, any, any>>>;
      resumeData?: any;
    };
    resume?: {
      steps: string[];
      resumePayload: any;
      runId?: string;
      label?: string;
      forEachIndex?: number;
    };
    [EMITTER_SYMBOL]: { emit: (event: string, data: any) => void };
    mastra: Mastra;
    requestContext?: RequestContext;
    engine: DefaultEngineType;
    abortSignal: AbortSignal;
    bail: (result: any) => any;
    abort: () => any;
    retryCount?: number;
    tracingContext?: TracingContext;
    writer?: WritableStream<ChunkType>;
    validateInputs?: boolean;
  }): Promise<z.infer<TOutput>> {
    this.__registerMastra(mastra);

    const effectiveValidateInputs = validateInputs ?? this.#options.validateInputs ?? true;

    this.#options = {
      ...(this.#options || {}),
      validateInputs: effectiveValidateInputs,
    };

    this.executionEngine.options = {
      ...(this.executionEngine.options || {}),
      validateInputs: effectiveValidateInputs,
    };

    const isResume =
      !!(resume?.steps && resume.steps.length > 0) ||
      !!resume?.label ||
      !!(resume?.steps && resume.steps.length === 0 && (!retryCount || retryCount === 0));
    // this check is for cases where you suspend/resume a nested workflow.
    // retryCount helps us know the step has been run at least once, which means it's running in a loop and should not be calling resume.

    if (!restart && !isResume) {
      this.#nestedWorkflowInput = inputData;
    }

    const isTimeTravel = !!(timeTravel && timeTravel.steps.length > 0);

    const run = isResume ? await this.createRun({ runId: resume.runId }) : await this.createRun({ runId });
    const nestedAbortCb = () => {
      abort();
    };
    run.abortController.signal.addEventListener('abort', nestedAbortCb);
    abortSignal.addEventListener('abort', async () => {
      run.abortController.signal.removeEventListener('abort', nestedAbortCb);
      await run.cancel();
    });

    const unwatch = run.watch(event => {
      emitter.emit('nested-watch', { event, workflowId: this.id });
    });

    if (retryCount && retryCount > 0 && isResume && requestContext) {
      requestContext.set('__mastraWorflowInputData', inputData);
    }

    let res: WorkflowResult<TState, TInput, TOutput, TSteps>;

    if (isTimeTravel) {
      res = await run.timeTravel({
        inputData: timeTravel?.inputData,
        resumeData: timeTravel?.resumeData,
        initialState: state,
        step: timeTravel?.steps,
        context: (timeTravel?.nestedStepResults?.[this.id] ?? {}) as any,
        nestedStepsContext: timeTravel?.nestedStepResults as any,
        requestContext,
        tracingContext,
        writableStream: writer,
        outputOptions: { includeState: true, includeResumeLabels: true },
      });
    } else if (restart) {
      res = await run.restart({ requestContext, tracingContext, writableStream: writer });
    } else if (isResume) {
      res = await run.resume({
        resumeData,
        step: resume.steps?.length > 0 ? (resume.steps as any) : undefined,
        requestContext,
        tracingContext,
        outputOptions: { includeState: true, includeResumeLabels: true },
        label: resume.label,
      });
    } else {
      res = await run.start({
        inputData,
        requestContext,
        tracingContext,
        writableStream: writer,
        initialState: state,
        outputOptions: { includeState: true, includeResumeLabels: true },
      });
    }

    unwatch();
    const suspendedSteps = Object.entries(res.steps).filter(([_stepName, stepResult]) => {
      const stepRes: StepResult<any, any, any, any> = stepResult as StepResult<any, any, any, any>;
      return stepRes?.status === 'suspended';
    });

    if (res.state) {
      setState(res.state);
    }

    if (suspendedSteps?.length) {
      for (const [stepName, stepResult] of suspendedSteps) {
        // @ts-ignore
        const suspendPath: string[] = [stepName, ...(stepResult?.suspendPayload?.__workflow_meta?.path ?? [])];
        await suspend(
          {
            ...(stepResult as any)?.suspendPayload,
            __workflow_meta: { runId: run.runId, path: suspendPath },
          },
          {
            resumeLabel: Object.keys(res.resumeLabels ?? {}),
          },
        );
      }
    }

    if (res.status === 'failed') {
      throw res.error;
    }

    return res.status === 'success' ? res.result : undefined;
  }

  async listWorkflowRuns(args?: StorageListWorkflowRunsInput) {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      this.logger.debug('Cannot get workflow runs. Mastra storage is not initialized');
      return { runs: [], total: 0 };
    }

    return storage.listWorkflowRuns({ workflowName: this.id, ...(args ?? {}) });
  }

  public async listActiveWorkflowRuns() {
    const runningRuns = await this.listWorkflowRuns({ status: 'running' });
    const waitingRuns = await this.listWorkflowRuns({ status: 'waiting' });

    return {
      runs: [...runningRuns.runs, ...waitingRuns.runs],
      total: runningRuns.total + waitingRuns.total,
    };
  }

  public async restartAllActiveWorkflowRuns(): Promise<void> {
    if (this.engineType !== 'default') {
      this.logger.debug(`Cannot restart active workflow runs for ${this.engineType} engine`);
      return;
    }
    const activeRuns = await this.listActiveWorkflowRuns();
    if (activeRuns.runs.length > 0) {
      this.logger.debug(
        `Restarting ${activeRuns.runs.length} active workflow run${activeRuns.runs.length > 1 ? 's' : ''}`,
      );
    }
    for (const runSnapshot of activeRuns.runs) {
      try {
        const run = await this.createRun({ runId: runSnapshot.runId });
        await run.restart();
        this.logger.debug(`Restarted ${this.id} workflow run ${runSnapshot.runId}`);
      } catch (error) {
        this.logger.error(`Failed to restart ${this.id} workflow run ${runSnapshot.runId}: ${error}`);
      }
    }
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
  ): Promise<WorkflowState | null> {
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
      activeStepsPath: (snapshot as WorkflowRunState).activeStepsPath,
      serializedStepGraph: (snapshot as WorkflowRunState).serializedStepGraph,
    };
  }
}

/**
 * Represents a workflow run that can be executed
 */

export class Run<
  TEngineType = any,
  TSteps extends Step<string, any, any, any, any, any, TEngineType>[] = Step<
    string,
    any,
    any,
    any,
    any,
    any,
    TEngineType
  >[],
  TState extends z.ZodObject<any> = z.ZodObject<any>,
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
   * Options around how to trace this run
   */
  readonly validateInputs?: boolean;

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
   * The steps for this workflow
   */

  readonly workflowSteps: Record<string, StepWithComponent>;

  readonly workflowRunStatus: WorkflowRunStatus;

  readonly workflowEngineType: WorkflowEngineType;

  /**
   * The storage for this run
   */
  #mastra?: Mastra;

  #observerHandlers: (() => void)[] = [];

  get mastra() {
    return this.#mastra;
  }

  protected streamOutput?: WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>>;
  protected closeStreamAction?: () => Promise<void>;
  protected executionResults?: Promise<WorkflowResult<TState, TInput, TOutput, TSteps>>;
  protected stateSchema?: z.ZodObject<any>;

  protected cleanup?: () => void;

  protected retryConfig?: {
    attempts?: number;
    delay?: number;
  };

  constructor(params: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    stateSchema?: z.ZodObject<any>;
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
    workflowSteps: Record<string, StepWithComponent>;
    validateInputs?: boolean;
    workflowEngineType: WorkflowEngineType;
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
    this.workflowSteps = params.workflowSteps;
    this.validateInputs = params.validateInputs;
    this.stateSchema = params.stateSchema;
    this.workflowRunStatus = 'pending';
    this.workflowEngineType = params.workflowEngineType;
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

  protected async _validateInput(inputData: z.input<TInput>) {
    const firstEntry = this.executionGraph.steps[0];
    let inputDataToUse = inputData;

    if (firstEntry && this.validateInputs) {
      let inputSchema: z.ZodType<any> | undefined;

      if (firstEntry.type === 'step' || firstEntry.type === 'foreach' || firstEntry.type === 'loop') {
        const step = firstEntry.step;
        inputSchema = step.inputSchema;
      } else if (firstEntry.type === 'conditional' || firstEntry.type === 'parallel') {
        const firstStep = firstEntry.steps[0];
        if (firstStep && firstStep.type === 'step') {
          inputSchema = firstStep.step.inputSchema;
        }
      }

      if (inputSchema) {
        const validatedInputData = await inputSchema.safeParseAsync(inputData);

        if (!validatedInputData.success) {
          const errors = getZodErrors(validatedInputData.error);
          throw new Error(
            'Invalid input data: \n' + errors.map((e: z.ZodIssue) => `- ${e.path?.join('.')}: ${e.message}`).join('\n'),
          );
        }

        inputDataToUse = validatedInputData.data;
      }
    }

    return inputDataToUse;
  }

  protected async _validateInitialState(initialState: z.input<TState>) {
    let initialStateToUse = initialState;
    if (this.validateInputs) {
      let inputSchema: z.ZodType<any> | undefined = this.stateSchema;

      if (inputSchema) {
        const validatedInputData = await inputSchema.safeParseAsync(initialState);

        if (!validatedInputData.success) {
          const errors = getZodErrors(validatedInputData.error);
          throw new Error(
            'Invalid input data: \n' + errors.map((e: z.ZodIssue) => `- ${e.path?.join('.')}: ${e.message}`).join('\n'),
          );
        }

        initialStateToUse = validatedInputData.data;
      }
    }

    return initialStateToUse;
  }

  protected async _validateResumeData<TResumeSchema extends z.ZodType<any>>(
    resumeData: z.input<TResumeSchema>,
    suspendedStep?: StepWithComponent,
  ) {
    let resumeDataToUse = resumeData;

    if (suspendedStep && suspendedStep.resumeSchema && this.validateInputs) {
      const resumeSchema = suspendedStep.resumeSchema;

      const validatedResumeData = await resumeSchema.safeParseAsync(resumeData);

      if (!validatedResumeData.success) {
        const errors = getZodErrors(validatedResumeData.error);
        throw new Error(
          'Invalid resume data: \n' + errors.map((e: z.ZodIssue) => `- ${e.path?.join('.')}: ${e.message}`).join('\n'),
        );
      }

      resumeDataToUse = validatedResumeData.data;
    }

    return resumeDataToUse;
  }

  protected async _validateTimetravelInputData<TInputSchema extends z.ZodType<any>>(
    inputData: z.input<TInputSchema>,
    step: Step<string, any, TInputSchema, any, any, any, TEngineType>,
  ) {
    let inputDataToUse = inputData;

    if (step && step.inputSchema && this.validateInputs) {
      const inputSchema = step.inputSchema;

      const validatedInputData = await inputSchema.safeParseAsync(inputData);

      if (!validatedInputData.success) {
        const errors = getZodErrors(validatedInputData.error);
        const errorMessages = errors.map((e: z.ZodIssue) => `- ${e.path?.join('.')}: ${e.message}`).join('\n');
        throw new Error('Invalid inputData: \n' + errorMessages);
      }

      inputDataToUse = validatedInputData.data;
    }

    return inputDataToUse;
  }

  protected async _start({
    inputData,
    initialState,
    requestContext,
    writableStream,
    tracingContext,
    tracingOptions,
    format,
    outputOptions,
  }: {
    inputData?: z.input<TInput>;
    initialState?: z.input<TState>;
    requestContext?: RequestContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    format?: 'legacy' | 'vnext' | undefined;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    // note: this span is ended inside this.executionEngine.execute()
    const workflowSpan = getOrCreateSpan({
      type: SpanType.WORKFLOW_RUN,
      name: `workflow run: '${this.workflowId}'`,
      input: inputData,
      attributes: {
        workflowId: this.workflowId,
      },
      metadata: {
        resourceId: this.resourceId,
        runId: this.runId,
      },
      tracingPolicy: this.tracingPolicy,
      tracingOptions,
      tracingContext,
      requestContext,
      mastra: this.#mastra,
    });

    const traceId = workflowSpan?.externalTraceId;
    const inputDataToUse = await this._validateInput(inputData);
    const initialStateToUse = await this._validateInitialState(initialState ?? {});

    const result = await this.executionEngine.execute<
      z.infer<TState>,
      z.infer<TInput>,
      WorkflowResult<TState, TInput, TOutput, TSteps>
    >({
      workflowId: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      disableScorers: this.disableScorers,
      graph: this.executionGraph,
      serializedStepGraph: this.serializedStepGraph,
      input: inputDataToUse,
      initialState: initialStateToUse,
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
      requestContext: requestContext ?? new RequestContext(),
      abortController: this.abortController,
      writableStream,
      workflowSpan,
      format,
      outputOptions,
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
  async start(args: {
    inputData?: z.input<TInput>;
    initialState?: z.input<TState>;
    requestContext?: RequestContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    return this._start(args);
  }

  /**
   * Starts the workflow execution with the provided input as a stream
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  streamLegacy({
    inputData,
    requestContext,
    onChunk,
    tracingContext,
    tracingOptions,
  }: {
    inputData?: z.input<TInput>;
    requestContext?: RequestContext;
    tracingContext?: TracingContext;
    onChunk?: (chunk: StreamEvent) => Promise<unknown>;
    tracingOptions?: TracingOptions;
  } = {}): {
    stream: ReadableStream<StreamEvent>;
    getWorkflowState: () => Promise<WorkflowResult<TState, TInput, TOutput, TSteps>>;
  } {
    if (this.closeStreamAction) {
      return {
        stream: this.observeStreamLegacy().stream,
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
        // watch events are data stream events, so we need to cast them to the correct type
        await writer.write(e as any);
        if (onChunk) {
          await onChunk(e as any);
        }
      } catch {}
    });

    this.closeStreamAction = async () => {
      this.emitter.emit('watch', {
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

    this.emitter.emit('watch', {
      type: 'workflow-start',
      payload: { runId: this.runId },
    });
    this.executionResults = this._start({
      inputData,
      requestContext,
      format: 'legacy',
      tracingContext,
      tracingOptions,
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
   * Starts the workflow execution with the provided input as a stream
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  stream(
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
  ): ReturnType<typeof this.streamVNext> {
    return this.streamVNext(args);
  }

  /**
   * Observe the workflow stream
   * @returns A readable stream of the workflow events
   */
  observeStreamLegacy(): {
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
        // watch events are data stream events, so we need to cast them to the correct type
        await writer.write(e as any);
      } catch {}
    });

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
  observeStream(): ReturnType<typeof this.observeStreamVNext> {
    return this.observeStreamVNext();
  }

  /**
   * Observe the workflow stream vnext
   * @returns A readable stream of the workflow events
   */
  observeStreamVNext(): ReadableStream<WorkflowStreamEvent> {
    if (!this.streamOutput) {
      return new ReadableStream<WorkflowStreamEvent>({
        pull(controller) {
          controller.close();
        },
        cancel(controller) {
          controller.close();
        },
      });
    }

    return this.streamOutput.fullStream;
  }

  async streamAsync({
    inputData,
    requestContext,
  }: { inputData?: z.input<TInput>; requestContext?: RequestContext } = {}): Promise<ReturnType<typeof this.stream>> {
    return this.stream({ inputData, requestContext });
  }

  /**
   * Starts the workflow execution with the provided input as a stream
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  streamVNext({
    inputData,
    requestContext,
    tracingContext,
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
  } = {}): WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>> {
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
          tracingContext,
          tracingOptions,
          initialState,
          outputOptions,
          writableStream: new WritableStream<WorkflowStreamEvent>({
            write(chunk) {
              controller.enqueue(chunk);
            },
          }),
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

  /**
   * Resumes the workflow execution with the provided input as a stream
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  resumeStream<TResumeSchema extends z.ZodType<any>>({
    step,
    resumeData,
    requestContext,
    tracingContext,
    tracingOptions,
    outputOptions,
  }: {
    resumeData?: z.input<TResumeSchema>;
    step?:
      | Step<string, any, any, any, TResumeSchema, any, TEngineType>
      | [
          ...Step<string, any, any, any, any, any, TEngineType>[],
          Step<string, any, any, any, TResumeSchema, any, TEngineType>,
        ]
      | string
      | string[];
    requestContext?: RequestContext;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
  } = {}) {
    return this.resumeStreamVNext({
      resumeData,
      step,
      requestContext,
      tracingContext,
      tracingOptions,
      outputOptions,
    });
  }

  /**
   * Resumes the workflow execution with the provided input as a stream
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  resumeStreamVNext<TResumeSchema extends z.ZodType<any>>({
    step,
    resumeData,
    requestContext,
    tracingContext,
    tracingOptions,
    forEachIndex,
    outputOptions,
  }: {
    resumeData?: z.input<TResumeSchema>;
    step?:
      | Step<string, any, any, any, TResumeSchema, any, TEngineType>
      | [
          ...Step<string, any, any, any, any, any, TEngineType>[],
          Step<string, any, any, any, TResumeSchema, any, TEngineType>,
        ]
      | string
      | string[];
    requestContext?: RequestContext;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    forEachIndex?: number;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
  } = {}) {
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
              stepName: (payload as unknown as { id: string }).id,
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
        const executionResultsPromise = self._resume({
          resumeData,
          step,
          requestContext,
          tracingContext,
          tracingOptions,
          writableStream: new WritableStream<WorkflowStreamEvent>({
            write(chunk) {
              controller.enqueue(chunk);
            },
          }),
          isVNext: true,
          forEachIndex,
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

  /**
   * @internal
   */
  watch(cb: (event: WorkflowStreamEvent) => void): () => void {
    const nestedWatchCb = ({
      event,
      workflowId,
    }: {
      event: { type: string; payload: { id: string } & Record<string, unknown> };
      workflowId: string;
    }) => {
      this.emitter.emit('watch', {
        ...event,
        ...(event.payload?.id ? { payload: { ...event.payload, id: `${workflowId}.${event.payload.id}` } } : {}),
      });
    };

    this.emitter.on('watch', cb);
    this.emitter.on('nested-watch', nestedWatchCb);

    return () => {
      this.emitter.off('watch', cb);
      this.emitter.off('nested-watch', nestedWatchCb);
    };
  }

  /**
   * @internal
   */
  async watchAsync(cb: (event: WorkflowStreamEvent) => void): Promise<() => void> {
    return this.watch(cb);
  }

  async resume<TResumeSchema extends z.ZodType<any>>(params: {
    resumeData?: z.input<TResumeSchema>;
    step?:
      | Step<string, any, any, any, TResumeSchema, any, TEngineType>
      | [
          ...Step<string, any, any, any, any, any, TEngineType>[],
          Step<string, any, any, any, TResumeSchema, any, TEngineType>,
        ]
      | string
      | string[];
    label?: string;
    requestContext?: RequestContext;
    retryCount?: number;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    writableStream?: WritableStream<ChunkType>;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    forEachIndex?: number;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    return this._resume(params);
  }

  /**
   * Restarts the workflow execution that was previously active
   * @returns A promise that resolves to the workflow output
   */
  async restart(
    args: {
      requestContext?: RequestContext;
      writableStream?: WritableStream<ChunkType>;
      tracingContext?: TracingContext;
      tracingOptions?: TracingOptions;
    } = {},
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    return this._restart(args);
  }

  protected async _resume<TResumeSchema extends z.ZodType<any>>(params: {
    resumeData?: z.input<TResumeSchema>;
    step?:
      | Step<string, any, any, TResumeSchema, any, any, TEngineType>
      | [
          ...Step<string, any, any, any, any, any, TEngineType>[],
          Step<string, any, any, TResumeSchema, any, any, TEngineType>,
        ]
      | string
      | string[];
    label?: string;
    requestContext?: RequestContext;
    retryCount?: number;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    writableStream?: WritableStream<ChunkType>;
    format?: 'legacy' | 'vnext' | undefined;
    isVNext?: boolean;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    forEachIndex?: number;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const snapshot = await this.#mastra?.getStorage()?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    if (!snapshot) {
      throw new Error('No snapshot found for this workflow run: ' + this.workflowId + ' ' + this.runId);
    }

    if (snapshot.status !== 'suspended') {
      throw new Error('This workflow run was not suspended');
    }

    const snapshotResumeLabel = params.label ? snapshot?.resumeLabels?.[params.label] : undefined;
    const stepParam = snapshotResumeLabel?.stepId ?? params.step;

    // Auto-detect suspended steps if no step is provided
    let steps: string[];
    if (stepParam) {
      let newStepParam = stepParam;
      if (typeof stepParam === 'string') {
        newStepParam = stepParam.split('.');
      }
      steps = (Array.isArray(newStepParam) ? newStepParam : [newStepParam]).map(step =>
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

    if (!params.retryCount) {
      const suspendedStepIds = Object.keys(snapshot?.suspendedPaths ?? {});

      const isStepSuspended = suspendedStepIds.includes(steps?.[0] ?? '');

      if (!isStepSuspended) {
        throw new Error(
          `This workflow step "${steps?.[0]}" was not suspended. Available suspended steps: [${suspendedStepIds.join(', ')}]`,
        );
      }
    }

    const suspendedStep = this.workflowSteps[steps?.[0] ?? ''];

    const resumeDataToUse = await this._validateResumeData(params.resumeData, suspendedStep);

    let requestContextInput;
    if (params.retryCount && params.retryCount > 0 && params.requestContext) {
      requestContextInput = params.requestContext.get('__mastraWorflowInputData');
      params.requestContext.delete('__mastraWorflowInputData');
    }

    const stepResults = { ...(snapshot?.context ?? {}), input: requestContextInput ?? snapshot?.context?.input } as any;

    const requestContextToUse = params.requestContext ?? new RequestContext();

    Object.entries(snapshot?.requestContext ?? {}).forEach(([key, value]) => {
      if (!requestContextToUse.has(key)) {
        requestContextToUse.set(key, value);
      }
    });

    // note: this span is ended inside this.executionEngine.execute()
    const workflowSpan = getOrCreateSpan({
      type: SpanType.WORKFLOW_RUN,
      name: `workflow run: '${this.workflowId}'`,
      input: resumeDataToUse,
      attributes: {
        workflowId: this.workflowId,
      },
      metadata: {
        resourceId: this.resourceId,
        runId: this.runId,
      },
      tracingPolicy: this.tracingPolicy,
      tracingOptions: params.tracingOptions,
      tracingContext: params.tracingContext,
      requestContext: requestContextToUse,
      mastra: this.#mastra,
    });

    const traceId = workflowSpan?.externalTraceId;

    const executionResultPromise = this.executionEngine
      .execute<z.infer<TState>, z.infer<TInput>, WorkflowResult<TState, TInput, TOutput, TSteps>>({
        workflowId: this.workflowId,
        runId: this.runId,
        resourceId: this.resourceId,
        graph: this.executionGraph,
        serializedStepGraph: this.serializedStepGraph,
        input: snapshot?.context?.input,
        initialState: (snapshot?.value ?? {}) as any,
        resume: {
          steps,
          stepResults,
          resumePayload: resumeDataToUse,
          // @ts-ignore
          resumePath: snapshot?.suspendedPaths?.[steps?.[0]] as any,
          forEachIndex: params.forEachIndex ?? snapshotResumeLabel?.foreachIndex,
          label: params.label,
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
        requestContext: requestContextToUse,
        abortController: this.abortController,
        workflowSpan,
        outputOptions: params.outputOptions,
        writableStream: params.writableStream,
      })
      .then(result => {
        if (!params.isVNext && result.status !== 'suspended') {
          this.closeStreamAction?.().catch(() => {});
        }
        result.traceId = traceId;
        return result;
      });

    this.executionResults = executionResultPromise;

    return executionResultPromise.then(result => {
      this.streamOutput?.updateResults(result as unknown as WorkflowResult<TState, TInput, TOutput, TSteps>);

      return result;
    });
  }

  protected async _restart({
    requestContext,
    writableStream,
    tracingContext,
    tracingOptions,
  }: {
    requestContext?: RequestContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    if (this.workflowEngineType !== 'default') {
      throw new Error(`restart() is not supported on ${this.workflowEngineType} workflows`);
    }

    const snapshot = await this.#mastra?.getStorage()?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    let nestedWorkflowPending = false;

    if (!snapshot) {
      throw new Error(`Snapshot not found for run ${this.runId}`);
    }

    if (snapshot.status !== 'running' && snapshot.status !== 'waiting') {
      if (snapshot.status === 'pending' && !!snapshot.context.input) {
        //possible the server died just before the nested workflow execution started.
        //only nested workflows have input data in context when it's still pending
        nestedWorkflowPending = true;
      } else {
        throw new Error('This workflow run was not active');
      }
    }

    let nestedWorkflowActiveStepsPath: Record<string, number[]> = {};

    const firstEntry = this.executionGraph.steps[0]!;

    if (firstEntry.type === 'step' || firstEntry.type === 'foreach' || firstEntry.type === 'loop') {
      nestedWorkflowActiveStepsPath = {
        [firstEntry.step.id]: [0],
      };
    } else if (firstEntry.type === 'sleep' || firstEntry.type === 'sleepUntil') {
      nestedWorkflowActiveStepsPath = {
        [firstEntry.id]: [0],
      };
    } else if (firstEntry.type === 'conditional' || firstEntry.type === 'parallel') {
      nestedWorkflowActiveStepsPath = firstEntry.steps.reduce(
        (acc, step) => {
          acc[step.step.id] = [0];
          return acc;
        },
        {} as Record<string, number[]>,
      );
    }
    const restartData: RestartExecutionParams = {
      activePaths: nestedWorkflowPending ? [0] : snapshot.activePaths,
      activeStepsPath: nestedWorkflowPending ? nestedWorkflowActiveStepsPath : snapshot.activeStepsPath,
      stepResults: snapshot.context,
      state: snapshot.value,
    };
    const requestContextToUse = requestContext ?? new RequestContext();
    for (const [key, value] of Object.entries(snapshot.requestContext ?? {})) {
      if (!requestContextToUse.has(key)) {
        requestContextToUse.set(key, value);
      }
    }
    const workflowSpan = getOrCreateSpan({
      type: SpanType.WORKFLOW_RUN,
      name: `workflow run: '${this.workflowId}'`,
      attributes: {
        workflowId: this.workflowId,
      },
      metadata: {
        resourceId: this.resourceId,
        runId: this.runId,
      },
      tracingPolicy: this.tracingPolicy,
      tracingOptions,
      tracingContext,
      requestContext: requestContextToUse,
      mastra: this.#mastra,
    });

    const traceId = workflowSpan?.externalTraceId;

    const result = await this.executionEngine.execute<
      z.infer<TState>,
      z.infer<TInput>,
      WorkflowResult<TState, TInput, TOutput, TSteps>
    >({
      workflowId: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      disableScorers: this.disableScorers,
      graph: this.executionGraph,
      serializedStepGraph: this.serializedStepGraph,
      restart: restartData,
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
      requestContext: requestContextToUse,
      abortController: this.abortController,
      writableStream,
      workflowSpan,
    });

    if (result.status !== 'suspended') {
      this.cleanup?.();
    }

    result.traceId = traceId;
    return result;
  }

  protected async _timeTravel<TInputSchema extends z.ZodType<any>>({
    inputData,
    resumeData,
    initialState,
    step: stepParam,
    context,
    nestedStepsContext,
    requestContext,
    writableStream,
    tracingContext,
    tracingOptions,
    outputOptions,
  }: {
    inputData?: z.input<TInputSchema>;
    resumeData?: any;
    initialState?: z.input<TState>;
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
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    if (!stepParam || (Array.isArray(stepParam) && stepParam.length === 0)) {
      throw new Error('Step is required and must be a valid step or array of steps');
    }

    const snapshot = await this.#mastra?.getStorage()?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    if (!snapshot) {
      throw new Error(`Snapshot not found for run ${this.runId}`);
    }

    if (snapshot.status === 'running') {
      throw new Error('This workflow run is still running, cannot time travel');
    }

    let steps: string[];
    let newStepParam = stepParam;
    if (typeof stepParam === 'string') {
      newStepParam = stepParam.split('.');
    }
    steps = (Array.isArray(newStepParam) ? newStepParam : [newStepParam]).map(step =>
      typeof step === 'string' ? step : step?.id,
    );

    let inputDataToUse = inputData;

    if (inputDataToUse && steps.length === 1) {
      inputDataToUse = await this._validateTimetravelInputData(inputData, this.workflowSteps[steps[0]!]!);
    }

    const timeTravelData = createTimeTravelExecutionParams({
      steps,
      inputData: inputDataToUse,
      resumeData,
      context,
      nestedStepsContext,
      snapshot,
      initialState,
      graph: this.executionGraph,
    });

    const requestContextToUse = requestContext ?? new RequestContext();
    for (const [key, value] of Object.entries(snapshot.requestContext ?? {})) {
      if (!requestContextToUse.has(key)) {
        requestContextToUse.set(key, value);
      }
    }

    const workflowSpan = getOrCreateSpan({
      type: SpanType.WORKFLOW_RUN,
      name: `workflow run: '${this.workflowId}'`,
      input: inputData,
      attributes: {
        workflowId: this.workflowId,
      },
      metadata: {
        resourceId: this.resourceId,
        runId: this.runId,
      },
      tracingPolicy: this.tracingPolicy,
      tracingOptions,
      tracingContext,
      requestContext: requestContextToUse,
      mastra: this.#mastra,
    });

    const traceId = workflowSpan?.externalTraceId;

    const result = await this.executionEngine.execute<
      z.infer<TState>,
      z.infer<TInput>,
      WorkflowResult<TState, TInput, TOutput, TSteps>
    >({
      workflowId: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      disableScorers: this.disableScorers,
      graph: this.executionGraph,
      timeTravel: timeTravelData,
      serializedStepGraph: this.serializedStepGraph,
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
      requestContext: requestContextToUse,
      abortController: this.abortController,
      writableStream,
      workflowSpan,
      outputOptions,
    });

    if (result.status !== 'suspended') {
      this.cleanup?.();
    }

    result.traceId = traceId;
    return result;
  }

  async timeTravel<TInputSchema extends z.ZodType<any>>(args: {
    inputData?: z.input<TInputSchema>;
    resumeData?: any;
    initialState?: z.input<TState>;
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
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    return this._timeTravel(args);
  }

  timeTravelStream<TInputSchema extends z.ZodType<any>>({
    inputData,
    resumeData,
    initialState,
    step,
    context,
    nestedStepsContext,
    requestContext,
    tracingContext,
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
    tracingContext?: TracingContext;
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
              stepName: (payload as unknown as { id: string }).id,
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
          tracingContext,
          tracingOptions,
          writableStream: new WritableStream<WorkflowStreamEvent>({
            write(chunk) {
              controller.enqueue(chunk);
            },
          }),
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

  /**
   * @access private
   * @returns The execution results of the workflow run
   */
  _getExecutionResults(): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> | undefined {
    return this.executionResults ?? this.streamOutput?.result;
  }
}
