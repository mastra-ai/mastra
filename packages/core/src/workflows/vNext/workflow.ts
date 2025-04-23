import { randomUUID } from 'crypto';
import EventEmitter from 'events';
import { z } from 'zod';
import type { Mastra } from '../..';
import type { MastraPrimitives } from '../../action';
import { Agent } from '../../agent';
import { MastraBase } from '../../base';
import { RuntimeContext } from '../../di';
import { RegisteredLogger } from '../../logger';
import { Tool } from '../../tools';
import type { ToolExecutionContext } from '../../tools/types';
import { DefaultExecutionEngine } from './default';
import type { ExecutionEngine, ExecutionGraph } from './execution-engine';
import type { ExecuteFunction, NewStep, NewStep as Step } from './step';
import type {
  StepsRecord,
  StepResult,
  WatchEvent,
  ExtractSchemaType,
  ExtractSchemaFromStep,
  PathsToStringProps,
  ZodPathType,
} from './types';

export type StepFlowEntry =
  | { type: 'step'; step: Step }
  | {
      type: 'parallel';
      steps: StepFlowEntry[];
    }
  | {
      type: 'conditional';
      steps: StepFlowEntry[];
      conditions: ExecuteFunction<any, any, any, any>[];
    }
  | {
      type: 'loop';
      step: Step;
      condition: ExecuteFunction<any, any, any, any>;
      loopType: 'dowhile' | 'dountil';
    }
  | {
      type: 'foreach';
      step: Step;
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
  execute: ExecuteFunction<z.infer<TStepInput>, z.infer<TStepOutput>, z.infer<TResumeSchema>, z.infer<TSuspendSchema>>;
}): Step<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema>;

export function createStep<
  TStepId extends string,
  TStepInput extends z.ZodObject<{ prompt: z.ZodString }>,
  TStepOutput extends z.ZodObject<{ text: z.ZodString }>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(agent: Agent<TStepId, any, any>): Step<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema>;

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
): Step<string, TSchemaIn, TSchemaOut, z.ZodType<any>, z.ZodType<any>>;

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
          z.infer<TSuspendSchema>
        >;
      }
    | Agent<any, any, any>
    | (Tool<TStepInput, TStepOutput, any> & {
        inputSchema: TStepInput;
        outputSchema: TStepOutput;
        execute: (context: ToolExecutionContext<TStepInput>) => Promise<any>;
      }),
): Step<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema> {
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
      execute: async ({ inputData }) => {
        const result = await params.generate(inputData.prompt, {
          // resourceId: inputData.resourceId,
          // threadId: inputData.threadId,
        });

        return {
          text: result.text,
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
      execute: async ({ inputData, mastra }) => {
        return await params.execute({
          context: inputData,
          mastra,
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
  step: Step<TStepId, any, any>,
  opts: { id: TStepId },
): Step<string, any, any> {
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
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
>(params: NewWorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>) {
  return new NewWorkflow(params);
}

export type WorkflowResult<TOutput extends z.ZodType<any>, TSteps extends Step<string, any, any>[]> =
  | {
      status: 'success';
      result: z.infer<TOutput>;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown>
          : StepResult<z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>>;
      };
    }
  | {
      status: 'failed';
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown>
          : StepResult<z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>>;
      };
      error: Error;
    }
  | {
      status: 'suspended';
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown>
          : StepResult<z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>>;
      };
      suspended: [string[], ...string[][]];
    };

export type NewWorkflowConfig<
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
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

export class NewWorkflow<
    TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
    TWorkflowId extends string = string,
    TInput extends z.ZodType<any> = z.ZodType<any>,
    TOutput extends z.ZodType<any> = z.ZodType<any>,
    TPrevSchema extends z.ZodType<any> = TInput,
  >
  extends MastraBase
  implements NewStep<TWorkflowId, TInput, TOutput>
{
  public id: TWorkflowId;
  public description?: string | undefined;
  public inputSchema: TInput;
  public outputSchema: TOutput;
  protected stepFlow: StepFlowEntry[];
  protected executionEngine: ExecutionEngine;
  protected executionGraph: ExecutionGraph;
  protected retryConfig: {
    attempts?: number;
    delay?: number;
  };
  #mastra?: Mastra;

  constructor({
    mastra,
    id,
    inputSchema,
    outputSchema,
    description,
    executionEngine,
    retryConfig,
  }: NewWorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>) {
    super({ name: id, component: RegisteredLogger.WORKFLOW });
    this.id = id;
    this.description = description;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
    this.retryConfig = retryConfig ?? { attempts: 0, delay: 0 };
    this.executionGraph = this.buildExecutionGraph();
    this.stepFlow = [];
    this.#mastra = mastra;

    if (!executionEngine) {
      // TODO: this should be configured using the Mastra class instance that's passed in
      this.executionEngine = new DefaultExecutionEngine({ mastra: this.#mastra });
    } else {
      this.executionEngine = executionEngine;
    }
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

  /**
   * Adds a step to the workflow
   * @param step The step to add to the workflow
   * @returns The workflow instance for chaining
   */
  then<TStepInputSchema extends TPrevSchema, TStepId extends string, TSchemaOut extends z.ZodType<any>>(
    step: Step<TStepId, TStepInputSchema, TSchemaOut, any, any>,
  ) {
    this.stepFlow.push({ type: 'step', step: step as any });
    return this as unknown as NewWorkflow<TSteps, TWorkflowId, TInput, TOutput, TSchemaOut>;
  }

  map<
    TSteps extends Step<string, any, any>[],
    TMapping extends {
      [K in keyof TMapping]:
        | {
            step: TSteps[number];
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
          };
    },
  >(mappingConfig: TMapping) {
    // Create an implicit step that handles the mapping
    const mappingStep: any = createStep({
      id: `mapping_${randomUUID()}`,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async ({ getStepResult, getInitData, runtimeContext }) => {
        const result: Record<string, any> = {};
        for (const [key, mapping] of Object.entries(mappingConfig)) {
          const m: any = mapping;

          if (m.value) {
            result[key] = m.value;
            continue;
          }

          if (m.runtimeContextPath) {
            result[key] = runtimeContext.get(m.runtimeContextPath);
            continue;
          }

          const stepResult = m.initData ? getInitData() : getStepResult(m.step);
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
            : TMapping[K] extends { value: any; schema: z.ZodTypeAny }
              ? TMapping[K]['schema']
              : TMapping[K] extends { runtimeContextPath: string; schema: z.ZodTypeAny }
                ? TMapping[K]['schema']
                : never;
      },
      any,
      z.ZodTypeAny
    >;

    this.stepFlow.push({ type: 'step', step: mappingStep as any });
    return this as unknown as NewWorkflow<TSteps, TWorkflowId, TInput, TOutput, MappedOutputSchema>;
  }

  // TODO: make typing better here
  parallel<TParallelSteps extends Step<string, TPrevSchema, any, any, any>[]>(steps: TParallelSteps) {
    this.stepFlow.push({ type: 'parallel', steps: steps.map(step => ({ type: 'step', step: step as any })) });
    return this as unknown as NewWorkflow<
      TSteps,
      TWorkflowId,
      TInput,
      TOutput,
      z.ZodObject<
        {
          [K in keyof StepsRecord<TParallelSteps>]: StepsRecord<TParallelSteps>[K]['outputSchema']['path'];
        },
        any,
        z.ZodTypeAny
      >
    >;
  }

  // TODO: make typing better here
  branch<
    TBranchSteps extends Array<
      [ExecuteFunction<z.infer<TPrevSchema>, any, any, any>, Step<string, TPrevSchema, any, any, any>]
    >,
  >(steps: TBranchSteps) {
    this.stepFlow.push({
      type: 'conditional',
      steps: steps.map(([_cond, step]) => ({ type: 'step', step: step as any })),
      conditions: steps.map(([cond]) => cond),
    });

    // Extract just the Step elements from the tuples array
    type BranchStepsArray = { [K in keyof TBranchSteps]: TBranchSteps[K][1] };

    // This creates a mapped type that extracts the second element from each tuple
    type ExtractedSteps = BranchStepsArray[number];

    // Now we can use this type as an array, similar to TParallelSteps
    return this as unknown as NewWorkflow<
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
    step: Step<TStepId, TStepInputSchema, TSchemaOut, any, any>,
    condition: ExecuteFunction<z.infer<TSchemaOut>, any, any, any>,
  ) {
    this.stepFlow.push({ type: 'loop', step: step as any, condition, loopType: 'dowhile' });
    return this as unknown as NewWorkflow<TSteps, TWorkflowId, TInput, TOutput, TSchemaOut>;
  }

  dountil<TStepInputSchema extends TPrevSchema, TStepId extends string, TSchemaOut extends z.ZodType<any>>(
    step: Step<TStepId, TStepInputSchema, TSchemaOut, any, any>,
    condition: ExecuteFunction<z.infer<TSchemaOut>, any, any, any>,
  ) {
    this.stepFlow.push({ type: 'loop', step: step as any, condition, loopType: 'dountil' });
    return this as unknown as NewWorkflow<TSteps, TWorkflowId, TInput, TOutput, TSchemaOut>;
  }

  foreach<
    TPrevIsArray extends TPrevSchema extends z.ZodArray<any> ? true : false,
    TStepInputSchema extends TPrevSchema extends z.ZodArray<infer TElement> ? TElement : never,
    TStepId extends string,
    TSchemaOut extends z.ZodType<any>,
  >(
    step: TPrevIsArray extends true
      ? Step<TStepId, TStepInputSchema, TSchemaOut, any, any>
      : 'Previous step must return an array type',
    opts?: {
      concurrency: number;
    },
  ) {
    this.stepFlow.push({ type: 'foreach', step: step as any, opts: opts ?? { concurrency: 1 } });
    return this as unknown as NewWorkflow<TSteps, TWorkflowId, TInput, TOutput, z.ZodArray<TSchemaOut>>;
  }

  /**
   * Builds the execution graph for this workflow
   * @returns The execution graph that can be used to execute the workflow
   */
  buildExecutionGraph(): ExecutionGraph {
    return {
      id: randomUUID(),
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
    return this as unknown as NewWorkflow<TSteps, TWorkflowId, TInput, TOutput, TOutput>;
  }

  get steps() {
    return this.stepFlow;
  }

  /**
   * Creates a new workflow run instance
   * @param options Optional configuration for the run
   * @returns A Run instance that can be used to execute the workflow
   */
  createRun(options?: { runId?: string }): Run<TSteps, TInput, TOutput> {
    const runIdToUse = options?.runId || randomUUID();

    // Return a new Run instance with object parameters
    return new Run({
      workflowId: this.id,
      runId: runIdToUse,
      executionEngine: this.executionEngine,
      executionGraph: this.executionGraph,
      mastra: this.#mastra,
      retryConfig: this.retryConfig,
    });
  }

  async execute({
    inputData,
    resumeData,
    suspend,
    resume,
    emitter,
    mastra,
  }: {
    inputData: z.infer<TInput>;
    resumeData?: any;
    getStepResult<T extends NewStep<any, any, any>>(
      stepId: T,
    ): T['outputSchema'] extends undefined ? unknown : z.infer<NonNullable<T['outputSchema']>>;
    suspend: (suspendPayload: any) => Promise<void>;
    resume?: {
      steps: string[];
      resumePayload: any;
      runId?: string;
    };
    emitter: EventEmitter;
    mastra: Mastra;
  }): Promise<z.infer<TOutput>> {
    this.__registerMastra(mastra);

    const run = resume?.steps?.length ? this.createRun({ runId: resume.runId }) : this.createRun();
    const unwatch = run.watch(event => {
      emitter.emit('nested-watch', { event, workflowId: this.id, runId: run.runId, isResume: !!resume?.steps?.length });
    });
    const res = resume?.steps?.length
      ? await run.resume({ resumeData, step: resume.steps as any })
      : await run.start({ inputData });
    unwatch();
    const suspendedSteps = Object.entries(res.steps).filter(([_stepName, stepResult]) => {
      const stepRes: StepResult<any> = stepResult as StepResult<any>;
      return stepRes?.status === 'suspended';
    });

    if (suspendedSteps?.length) {
      for (const [stepName, stepResult] of suspendedSteps) {
        // @ts-ignore
        const suspendPath: string[] = [stepName, ...(stepResult?.payload?.__workflow_meta?.path ?? [])];
        await suspend({
          ...(stepResult as any)?.payload,
          __workflow_meta: { runId: run.runId, path: suspendPath },
        });
      }
    }

    if (res.status === 'failed') {
      throw res.error;
    }

    return res.status === 'success' ? res.result : undefined;
  }

  async getWorkflowRuns() {
    const storage = this.#mastra?.getStorage();
    if (!storage) {
      this.logger.debug('Cannot get workflow runs. Mastra engine is not initialized');
      return { runs: [], total: 0 };
    }

    return storage.getWorkflowRuns({ workflowName: this.id });
  }

  async getWorkflowRun(runId: string) {
    const runs = await this.getWorkflowRuns();
    return runs.runs.find(r => r.runId === runId);
  }
}

/**
 * Represents a workflow run that can be executed
 */
export class Run<
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
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
   * The storage for this run
   */
  #mastra?: Mastra;

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
  }) {
    this.workflowId = params.workflowId;
    this.runId = params.runId;
    this.executionEngine = params.executionEngine;
    this.executionGraph = params.executionGraph;
    this.#mastra = params.mastra;
    this.emitter = new EventEmitter();
    this.retryConfig = params.retryConfig;
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
    return this.executionEngine.execute<z.infer<TInput>, WorkflowResult<TOutput, TSteps>>({
      workflowId: this.workflowId,
      runId: this.runId,
      graph: this.executionGraph,
      input: inputData,
      emitter: this.emitter,
      retryConfig: this.retryConfig,
      runtimeContext: runtimeContext ?? new RuntimeContext(),
    });
  }

  watch(cb: (event: WatchEvent) => void): () => void {
    this.emitter.on('watch', ({ type, payload, eventTimestamp }) => {
      this.updateState(payload);
      cb({ type, payload: this.getState() as any, eventTimestamp: eventTimestamp });
    });
    this.emitter.on('nested-watch', ({ event, workflowId }) => {
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
            ...payload?.workflowState,
            steps: prefixedSteps,
          },
        };
        this.updateState(newPayload);
        cb({ type, payload: this.getState() as any, eventTimestamp: eventTimestamp });
      } catch (e) {
        console.error(e);
      }
    });
    return () => {
      this.emitter.off('watch', cb);
    };
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
    const steps: string[] = (Array.isArray(params.step) ? params.step : [params.step]).map(step =>
      typeof step === 'string' ? step : step?.id,
    );
    const snapshot = await this.#mastra?.storage?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    return this.executionEngine.execute<z.infer<TInput>, WorkflowResult<TOutput, TSteps>>({
      workflowId: this.workflowId,
      runId: this.runId,
      graph: this.executionGraph,
      input: params.resumeData,
      resume: {
        steps,
        stepResults: snapshot?.context as any,
        resumePayload: params.resumeData,
        // @ts-ignore
        resumePath: snapshot?.suspendedPaths?.[steps?.[0]] as any,
      },
      emitter: this.emitter,
      runtimeContext: params.runtimeContext ?? new RuntimeContext(),
    });
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
    }
    if (state.workflowState) {
      this.state.workflowState = deepMerge(this.state.workflowState ?? {}, state.workflowState ?? {});
    }
  }
}

function deepMerge(a: Record<string, any>, b: Record<string, any>): Record<string, any> {
  if (!a || typeof a !== 'object') return b;
  if (!b || typeof b !== 'object') return a;

  const result = { ...a };

  for (const key in b) {
    if (b[key] === undefined) continue;

    if (b[key] !== null && typeof b[key] === 'object') {
      const aVal = result[key];
      const bVal = b[key];

      if (Array.isArray(bVal)) {
        result[key] = Array.isArray(aVal)
          ? [...aVal, ...bVal].filter(item => item !== undefined)
          : bVal.filter(item => item !== undefined);
      } else if (typeof aVal === 'object' && aVal !== null) {
        // If both values are objects, merge them
        result[key] = deepMerge(aVal, bVal);
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
