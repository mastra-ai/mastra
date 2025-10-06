import EventEmitter from 'events';
import { randomUUID } from 'node:crypto';
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

/**
 * Maps a value within the scope of the workflow to the input of the next step or workflow.
 *
 * Supported mappings:
 * - previous step output
 * - init data (input data of the workflow itself)
 * @param params Configuration parameters for the mapping
 * @param params.step The step to map the value from
 * @param params.initData The reference to the workflow to map the value from
 * @param params.path The path to the value to extract initData or step output to bind. `.` can be used to map the entire step output or init data.
 * @returns The mapped variable
 *
 * @example
 * ```typescript
 * workflow
 *   .then(step1)
 *   .map({
 *     test: mapVariable({
 *       initData: workflow,
 *       path: 'myInputProperty1.myProperty2',
 *     }),
 *     test2: mapVariable({
 *       step: step1,
 *       path: '.',
 *     }),
 *   })
 *   .then(step2)
 *   .commit();
 * ```
 */
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
  TSuspendSchema extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
  TContext extends ToolExecutionContext<TSchemaIn, TSuspendSchema, TResumeSchema>,
> = Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> & {
  inputSchema: TSchemaIn;
  outputSchema: TSchemaOut;
  execute: (context: TContext) => Promise<any>;
};

/**
 * Creates a new workflow step
 * @param params Configuration parameters for the step
 * @param params.id Unique identifier for the step
 * @param params.description Optional description of what the step does
 * @param params.inputSchema Zod schema defining the input structure of the inputData argument of the execute function
 * @param params.outputSchema Zod schema defining the output structure of the returned value of the execute function.
 * @param params.resumeSchema Zod schema defining the structure of the resumeData argument of the execute function.
 * @param params.suspendSchema Zod schema defining the structure of the input of the suspend function argumentof the execute function.
 * @param params.retries Number of retries to attempt if the step fails.
 * @param params.scorers DynamicArgument<MastraScorers> - Optional scorers to use for the step.
 * @param params.execute Function that performs the step's operations. The arguments of the execute function are:
 * - inputData
 * - resumeData
 * - suspend
 * - mastra
 * - runtimeContext
 * - abortSignal
 * - writer
 * - abort
 * - bail
 * @returns A Step object that can be added to the workflow
 *
 * A step can also be created from a Tool, Agent or Workflow
 *
 *
 * @example
 * ```typescript
 * import { createStep } from "@mastra/core/workflows"
 *
 * const step1 = createStep({
 *   id: 'step1',
 *   inputSchema: z.object({
 *    start: z.string()
 *   }),
 *   outputSchema: z.object({
 *     start: z.string()
 *     }),
 *   }),
 *   execute: async ({ inputData }) => {
 *     return inputData;
 *   },
 * });
 *
 * const step2 = createStep({
 *   id: 'step2',
 *   inputSchema: z.object({
 *     start: z.string()
 *   }),
 *   resumeSchema: z.object({
 *     resume: z.string()
 *   }),
 *   suspendSchema: z.object({
 *     message: z.string()
 *   }),
 *   outputSchema: z.object({
 *     fullText: z.string()
 *   }),
 *   execute: async ({ inputData, resumeData, suspend }) => {
 *     if (!resumeData.resume) {
 *       return suspend({ message: 'Please provide the resume value' });
 *     }
 *     const fullText = `${inputData.start} ${resumeData.resume}`;
 *     return {
 *       fullText,
 *     };
 *   },
 * });
 *
 * ```
 *
 * @example
 * ```typescript
 * import { myTool } from "../tools"
 * import { createStep } from "@mastra/core/workflows"
 *
 * const stepFromTool = createStep(myTool)
 * ```
 *
 * @example
 * ```typescript
 * import { myAgent } from "../agents"
 * import { createStep } from "@mastra/core/workflows"
 *
 * const stepFromAgent = createStep(myAgent)
 * ```
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
  TSuspendSchema extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
  TContext extends ToolExecutionContext<TSchemaIn>,
>(
  tool: ToolStep<TSchemaIn, TSuspendSchema, TResumeSchema, TSchemaOut, TContext>,
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
    | ToolStep<TStepInput, TSuspendSchema, TResumeSchema, TStepOutput, any>,
): Step<TStepId, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, DefaultEngineType> {
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

        let stream: ReadableStream<any>;

        if ((await params.getModel()).specificationVersion === 'v1') {
          const { fullStream } = await params.streamLegacy(inputData.prompt, {
            // resourceId: inputData.resourceId,
            // threadId: inputData.threadId,
            runtimeContext,
            onFinish: result => {
              streamPromise.resolve(result.text);
            },
            abortSignal,
          });
          stream = fullStream as any;
        } else {
          const modelOutput = await params.stream(inputData.prompt, {
            runtimeContext,
            onFinish: result => {
              streamPromise.resolve(result.text);
            },
            abortSignal,
          });

          stream = modelOutput.fullStream;
        }

        if (streamFormat === 'aisdk') {
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
      execute: async ({ inputData, mastra, runtimeContext, tracingContext, suspend, resumeData }) => {
        return params.execute({
          context: inputData,
          mastra,
          runtimeContext,
          tracingContext,
          suspend,
          resumeData,
        });
      },
      component: 'TOOL',
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

/**
 * Clones a step and returns a new step with the same configuration but a new id.
 * @param step - The step to clone.
 * @param opts - The options for the new step - id (id of the new step).
 * @returns The cloned step.
 *
 * @example
 * ```typescript
 * const step = createStep({
 *   id: 'step1',
 *   inputSchema: z.object({ start: z.string() }),
 *   outputSchema: z.object({ fullText: z.string() }),
 *   execute: async ({ inputData }) => {
 *     return {
 *       fullText: inputData.start,
 *     };
 *   },
 * });
 *
 * const clonedStep = cloneStep(step, { id: 'step2' });
 * ```
 */

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
    component: step.component,
  };
}

/**
 * Creates a new workflow.
 * @param params - The parameters for the new workflow.
 * @param params.id - The id of the workflow.
 * @param params.description - The description of the workflow.
 * @param params.inputSchema - Zod schema defining the input structure of the inputData of the first step in the workflow
 * @param params.outputSchema - Zod schema defining the output structure of the returned value of the last step in the workflow.
 * @param params.steps - The steps in the workflow.
 * @param params.retryConfig - The retry configuration of the workflow. Contains the number of attempts and the delay between attempts.
 * @param params.options - The options of the workflow. Contains the tracingPolicy and the validateInputs option.
 * @param params.mastra - The Mastra instance.
 * @returns The new workflow.
 *
 * A workflow can also be created from a WorkflowConfig object.
 *
 * @example
 * ```typescript
 * const workflow = createWorkflow({
 *   id: 'workflow1',
 *   description: 'My workflow',
 *   inputSchema: z.object({
 *     input: z.string(),
 *   }),
 *   outputSchema: z.object({
 *     output: z.string(),
 *   }),
 *   retryConfig: { attempts: 3, delay: 1000 },
 *   options: { tracingPolicy: { internal: InternalSpans.ALL }, validateInputs: true },
 *   steps: [step1],
 * }).then(step1).commit();
 *
 * ```
 *
 */
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

/**
 * Clones a workflow and returns a new workflow with the same configuration but a new id.
 * @param workflow - The workflow to clone.
 * @param opts - The options for the new workflow - id (id of the new workflow).
 * @returns The cloned workflow.
 *
 * @example
 * ```typescript
 * const workflow = createWorkflow({
 *   id: 'workflow1',
 *   description: 'My workflow',
 *   inputSchema: z.object({
 *     input: z.string(),
 *   }),
 *   outputSchema: z.object({
 *     output: z.string(),
 *   }),
 *   retryConfig: { attempts: 3, delay: 1000 },
 *   options: { tracingPolicy: { internal: InternalSpans.ALL }, validateInputs: true },
 *   steps: [step1],
 * }).then(step1).commit();
 * const clonedWorkflow = cloneWorkflow(workflow, { id: 'cloned-workflow' });
 * ```
 */

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
  #options: WorkflowOptions;
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
    this.#options = options ?? { validateInputs: false };

    if (!executionEngine) {
      // TODO: this should be configured using the Mastra class instance that's passed in
      this.executionEngine = new DefaultExecutionEngine({
        mastra: this.#mastra,
        options: { tracingPolicy: options?.tracingPolicy, validateInputs: options?.validateInputs },
      });
    } else {
      this.executionEngine = executionEngine;
    }

    this.#runs = new Map();
  }

  /*
   * Returns the map of runs for this workflow
   */
  get runs() {
    return this.#runs;
  }

  /**
   * Returns the mastra instance for this workflow
   */
  get mastra() {
    return this.#mastra;
  }

  /**
   * Returns the options for this workflow. These are the options that were passed to the workflow constructor. Contains the validateInputs and tracingPolicy options.
   */
  get options() {
    return this.#options;
  }

  /*@internal*/
  __registerMastra(mastra: Mastra) {
    this.#mastra = mastra;
    this.executionEngine.__registerMastra(mastra);
  }

  /*@internal*/
  __registerPrimitives(p: MastraPrimitives) {
    if (p.telemetry) {
      this.__setTelemetry(p.telemetry);
    }

    if (p.logger) {
      this.__setLogger(p.logger);
    }
  }

  /*@internal*/
  setStepFlow(stepFlow: StepFlowEntry<TEngineType>[]) {
    this.stepFlow = stepFlow;
  }

  /**
   * Adds a step to the workflow
   * @param step The step or workflow to add to the workflow
   * @returns The workflow instance for chaining
   *
   * The input schema for the next step should match the output schema of the previous step.
   * For cases where the schemas don't match, use the `map` function to transform the output to the expected schema.
   * Steps added with `.then` run one after another in sequence.
   *
   * @example
   * ```typescript
   * workflow.then(step1).then(step2).then(myWorkflow).commit();
   * ```
   */
  then<TStepId extends string, TSchemaOut extends z.ZodType<any>>(
    step: Step<TStepId, TPrevSchema, TSchemaOut, any, any, TEngineType>,
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
   *
   * Duration can either be a number of milliseconds or a callback function that returns the number of milliseconds to sleep.
   * The callback function function is similar to the execute function for steps, and receives the ouput from the previous step as inputData.
   *
   * Steps added with `.sleep` run one after another in sequence, but are paused for the specified duration.
   *
   * @example
   * ```typescript
   * workflow.then(step1).sleep(1000).then(step2).commit();
   * ```
   *
   * @example
   * ```typescript
   * workflow.then(step1).sleep(async ({ inputData }) => {
   *   return inputData.value * 1000;
   * }).then(step2).commit();
   * ```
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
   *
   * Date can either be a Date object or a callback function that returns a Date object.
   * The callback function function is similar to the execute function for steps, and receives the ouput from the previous step as inputData.
   *
   * Steps added with `.sleepUntil` run one after another in sequence.
   *
   * @example
   * ```typescript
   * workflow.then(step1).sleepUntil(new Date(Date.now() + 5000)).then(step2).commit();
   * ```
   *
   * @example
   * ```typescript
   * workflow.then(step1).sleepUntil(async ({ inputData }) => {
   *   return new Date(Date.now() + inputData.value);
   * }).then(step2).commit();
   * ```
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

  /**
   * Adds a wait for event step to the workflow
   * @param event The event to wait for
   * @param step The step or workflow to resume when the event is received
   * @returns The workflow instance for chaining
   *
   * Events can be sent to the workflow using `run.sendEvent()` method on the run. The workflow execution is halted until the event is received. The step passed to it is executed after the event is received.
   * The behavior is similar to `sleepUntil` but for events instead of dates.
   *
   * Steps added with `.waitForEvent` run one after another in sequence.
   *
   * @example
   * ```typescript
   * workflow.then(step1).waitForEvent('my-event', step2).then(step3).commit();
   * ```
   */
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

  /**
   * Adds a mapping step to the workflow
   * @param mappingConfig The mapping configuration
   * @param stepOptions The options for the mapping step. Takes an optional `id` parameter to set the id of the mapping step.
   * @returns The workflow instance for chaining
   *
   * The mappingConfig can be an object where the key is what you want to call the value, and the value is the definition of the mapping or where the value comes from.
   *
   * Mapping can be done using a step, a value, an initData, a runtimeContextPath, or a callback function.
   *
   * @example
   * ```typescript
   * workflow.then(step1).map({
   *   result: {
   *     step: step2,
   *     path: 'result',
   *   },
   *   initData: {
   *     initData: workflow,
   *     path: 'result',
   *   },
   *   runtimeContextPath: {
   *     runtimeContextPath: 'result',
   *     schema: z.number(),
   *   },
   *   value: {
   *     value: 42,
   *     schema: z.number(),
   *   },
   *   callback: {
   *     fn: async ({ inputData }) => {
   *       return inputData.result;
   *     },
   *     schema: z.number(),
   *   },
   * }).then(step2).commit();
   * ```
   *
   * The mappingConfig can also be a callback function that returns the object to use as input to the next step.
   *
   * @example
   * ```typescript
   * workflow.then(step1).map(async ({ inputData }) => {
   *   return { input: inputData.result };
   * }).then(step2).commit();
   * ```
   */
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
      inputSchema: z.any(),
      outputSchema: z.any(),
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

  /**
   * Adds a list of steps to run in parallel to the workflow
   * @param steps The steps or workflows to run in parallel
   * @returns The workflow instance for chaining
   *
   * Steps added with `.parallel` run in parallel.
   *
   * The inputSchema of all the steps in the parallel array should match the output schema of the previous step or the inputSchema of the workflow if there is no previous step.
   *
   * The next step receives the output of the parallel steps as an object where the key is the step id and the value is the step output.
   *
   * If there is a step after the parallel steps, it only runs after all the parallel steps have completed.
   *
   * If you want to change the shape of the output, you can use the `map` function to transform the output to the expected schema of the next step.
   *
   * @example
   * ```typescript
   * workflow.parallel([step1, step2, myWorkflow]).then(step3).commit();
   * ```
   *
   */

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

  /**
   * Adds a list of steps to run in conditional branches to the workflow
   * @param steps The steps or workflows to run in conditional branches
   * @returns The workflow instance for chaining
   *
   * This is similar to `.parallel` but for conditional branches instead of parallel execution. Each item in the array is a tuple containing a condition function and a step to execute if the condition is true.
   *
   * Only the steps with truthy conditions are executed in parallel.
   *
   * The inputSchema of all the steps in the branch array should match the output schema of the previous step or the inputSchema of the workflow if there is no previous step.
   *
   * The output of the steps with truthy conditions is passed to the next step as an object where the key is the step id and the value is the step output.
   *
   * If there is a step after the branch steps, it only runs after all the branch steps have completed.
   *
   * If you want to change the shape of the output, you can use the `map` function to transform the output to the expected schema of the next step.
   *
   * @example
   * ```typescript
   * workflow.branch([
   *   [async ({ inputData }) => inputData.value > 50, highValueStep],
   *   [async ({ inputData }) => inputData.value <= 50, lowValueWorkflow],
   * ]).then(finalStep).commit();
   * ```
   *
   */
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

  /**
   * Adds a loop to the workflow
   * @param step The step or workflow to loop
   * @param condition The condition that determines when to stop the loop
   * @returns The workflow instance for chaining
   *
   * The inputSchema of the step should match the output schema of the previous step or the inputSchema of the workflow if there is no previous step.
   *
   * The inputSchema and outputSchema of the looped step has to be the same.
   *
   * The step will be executed repeatedly while the condition is true.
   *
   * The next step receives the last output from the looped step as its input.
   *
   * @example
   * ```typescript
   * workflow.dowhile(step1, async ({ inputData }) => inputData.value < 10).then(step2).commit();
   * ```
   */
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

  /**
   * Adds a loop to the workflow
   * @param step The step or workflow to loop
   * @param condition The condition that determines when to stop the loop
   * @returns The workflow instance for chaining
   *
   * The inputSchema of the step should match the output schema of the previous step or the inputSchema of the workflow if there is no previous step.
   *
   * The inputSchema and outputSchema of the looped step has to be the same.
   *
   * The step will be executed repeatedly until the condition is true.
   *
   * The next step receives the last output from the looped step as its input.
   *
   * @example
   * ```typescript
   * workflow.dountil(step1, async ({ inputData }) => inputData.value >= 10).then(step2).commit();
   * ```
   */
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

  /**
   * Adds a foreach loop to the workflow
   * @param step The step or workflow to loop
   * @param opts Optional configuration for the loop
   * @returns The workflow instance for chaining
   *
   * The output of the previous step must be an array with items that match the inputSchema of the step in the `foreach` method.
   *
   * If the inputSchema of the step is `z.object({ value: z.number() })`, then `foreach` will expect `z.array(z.object({ value: z.number() }))`.
   *
   * The step is executed for each item in the array in sequence one at a time.
   *
   * The next step receives an array of all the outputs from the looped step.
   *
   * For example, if the outputSchema of the step is `z.object({ result: z.number() })`, then the result of the `foreach` loop will be `z.array(z.object({ result: z.number() }))`.
   *
   * @example
   * ```typescript
   * workflow.then(step1).foreach(step2).then(step3).commit();
   * ```
   *
   */
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
   * @internal
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
   *
   * This method must be called after all steps have been added to the workflow.
   *
   * @example
   * ```typescript
   * workflow.then(step1).then(step2).then(step3).commit();
   * ```
   */
  commit() {
    this.executionGraph = this.buildExecutionGraph();
    return this as unknown as Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, TOutput>;
  }

  /**
   * @internal
   * Returns the step graph for this workflow
   * @returns The step graph
   */
  get stepGraph() {
    return this.stepFlow;
  }

  /**
   * @internal
   * Returns the serialized step graph for this workflow
   * @returns The serialized step graph
   */
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
   *
   * @example
   * ```typescript
   * const run = await workflow.createRunAsync({
   *   runId: '123',
   *   resourceId: '456',
   *   disableScorers: false,
   * });
   * ```
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
        tracingPolicy: this.#options?.tracingPolicy,
        workflowSteps: this.steps,
        validateInputs: this.#options?.validateInputs,
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

  /**
   * Returns the scorers running in this workflow
   * @param options Optional configuration for the scorers
   * @param options.runtimeContext Optional runtime context for the scorers
   * @returns The scorers running in this workflow
   *
   * @example
   * ```typescript
   * const scorers = await workflow.getScorers();
   * console.log(scorers);
   * ```
   */
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

  /**
   * @internal
   * Executes a workflow
   * @returns The result of the workflow
   *
   * This method should only be called internally for nested workflow execution, as well as from mastra server handlers
   * To run a workflow use `.createRunAsync` and then `.start` or `.resume`
   */
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
    validateInputs,
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
    validateInputs?: boolean;
  }): Promise<z.infer<TOutput>> {
    this.__registerMastra(mastra);

    if (validateInputs) {
      this.#options = {
        ...(this.#options || {}),
        validateInputs: validateInputs,
      };
    }

    this.executionEngine.options = {
      ...(this.executionEngine.options || {}),
      validateInputs,
    };

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

  /**
   * Returns the workflow runs for this workflow
   * @param args Optional arguments for the workflow runs
   * @param args.fromDate Optional date to filter the workflow runs from
   * @param args.toDate Optional date to filter the workflow runs to
   * @param args.limit Optional limit for the number of workflow runs
   * @param args.offset Optional offset for the workflow runs
   * @param args.resourceId Optional resource ID to filter the workflow runs by
   * @returns The workflow runs for this workflow
   *
   * @example
   * ```typescript
   * const runs = await workflow.getWorkflowRuns({
   *   fromDate: new Date('2021-01-01'),
   *   toDate: new Date('2021-01-02'),
   *   limit: 10,
   *   offset: 0,
   *   resourceId: '123',
   * });
   * console.log(runs);
   * ```
   */

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

  /**
   * Returns the workflow run by its ID
   * @param runId The ID of the workflow run
   * @returns The workflow run
   *
   * @example
   * ```typescript
   * const run = await workflow.getWorkflowRunById('123');
   * console.log(run);
   * ```
   */
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

  /**
   * Returns the execution result of a workflow run
   * @param runId The ID of the workflow run
   * @param withNestedWorkflows Whether to include the execution result of nested workflows. Default is true.
   * @returns The execution result of the workflow run
   *
   * @example
   * ```typescript
   * const result = await workflow.getWorkflowRunExecutionResult('123', true);
   * console.log(result);
   * ```
   */

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

  /**
   * The storage for this run
   */
  #mastra?: Mastra;

  #observerHandlers: (() => void)[] = [];

  get mastra() {
    return this.#mastra;
  }

  protected closeStreamAction?: () => Promise<void>;
  protected activeStream?: MastraWorkflowStream<TInput, TOutput, TSteps>;
  protected executionResults?: Promise<WorkflowResult<TInput, TOutput, TSteps>>;

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
    workflowSteps: Record<string, StepWithComponent>;
    validateInputs?: boolean;
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
  }

  /**
   * Returns the abort controller for this run
   */
  public get abortController(): AbortController {
    if (!this.#abortController) {
      this.#abortController = new AbortController();
    }

    return this.#abortController;
  }

  /**
   * Cancels the workflow execution and stops the workflow run.
   * If there is a step being executed, it waits for it to finish before stopping the run.
   *
   * If the step was created from an agent or has an LLM call with the abortController passed, it will abort the call.
   *
   * @example
   * ```typescript
   * const run = await workflow.createRunAsync();
   * run.start({ inputData: { value: 'hello' } });
   * setTimeout(() => {
   *   run.cancel();
   * }, 2000);
   * ```
   */
  async cancel() {
    this.abortController?.abort();
  }

  /**
   * Sends an event to the workflow run.
   * @param event - The event to send.
   * @param data - The data to send with the event.
   *
   * This is often used with `waitForEvent` to resume the workflow after the event is received. In the execcution function of the step, the event payload will be under resumeData.
   *
   * @example
   * ```typescript
   * workflow.then(step1).waitForEvent('my-event', step2).then(step3).commit();
   *
   * const run = await workflow.createRunAsync();
   * run.start({ inputData: {} }); // This will start the workflow execution, after the step1 is executed, the workflow will wait for the event 'my-event'
   * run.sendEvent('my-event', { data: 'hello' }); // This will send the event to the workflow run, and the workflow will resume from the step2
   * ```
   *
   */
  async sendEvent(event: string, data: any) {
    this.emitter.emit(`user-event-${event}`, data);
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
          throw new Error(
            'Invalid input data: \n' +
              validatedInputData.error.errors.map((e: z.ZodIssue) => `- ${e.path?.join('.')}: ${e.message}`).join('\n'),
          );
        }

        inputDataToUse = validatedInputData.data;
      }
    }

    return inputDataToUse;
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
        throw new Error(
          'Invalid resume data: \n' +
            validatedResumeData.error.errors.map((e: z.ZodIssue) => `- ${e.path?.join('.')}: ${e.message}`).join('\n'),
        );
      }

      resumeDataToUse = validatedResumeData.data;
    }

    return resumeDataToUse;
  }

  protected async _start({
    inputData,
    runtimeContext,
    writableStream,
    tracingContext,
    tracingOptions,
    format,
  }: {
    inputData?: z.input<TInput>;
    runtimeContext?: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    format?: 'aisdk' | 'mastra' | undefined;
  }): Promise<WorkflowResult<TInput, TOutput, TSteps>> {
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

    const inputDataToUse = await this._validateInput(inputData);

    const result = await this.executionEngine.execute<z.infer<TInput>, WorkflowResult<TInput, TOutput, TSteps>>({
      workflowId: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      disableScorers: this.disableScorers,
      graph: this.executionGraph,
      serializedStepGraph: this.serializedStepGraph,
      input: inputDataToUse,
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
   * @params.inputData The input data for the workflow. The inputData structure is determined by the workflow inputSchema
   * @params.runtimeContext The runtime context for the workflow.
   * @params.writableStream The writable stream for the workflow.
   * @params.tracingContext The tracing context for the workflow.
   * @params.tracingOptions The tracing options for the workflow.
   * @returns A promise that resolves to the workflow output
   *
   * The promise resolves when the workflow state becomes `success`, `suspended` or `failed`.
   *
   * @example
   * ```typescript
   * const run = await workflow.createRunAsync();
   * const result = await run.start({ inputData: { value: 'hello' } });
   * console.log(result);
   * ```
   */
  async start({
    inputData,
    runtimeContext,
    writableStream,
    tracingContext,
    tracingOptions,
  }: {
    inputData?: z.input<TInput>;
    runtimeContext?: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
  }): Promise<WorkflowResult<TInput, TOutput, TSteps>> {
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
   * Starts the workflow execution with the provided input and returns a stream of the workflow events.
   * @param inputData The input data for the workflow. The inputData structure is determined by the workflow inputSchema
   * @param runtimeContext The runtime context for the workflow.
   * @param onChunk The callback function to handle the chunk. It will be called for each workflow event.
   * @param tracingContext The tracing context for the workflow.
   * @param tracingOptions The tracing options for the workflow.
   * @returns An object with the stream and the getWorkflowState function.
   *
   * getWorkflowState returns a promise that resolves to the workflow output.
   *
   * The stream only ends when the workflow state becomes `success` or `failed`. It remains open otherwise.
   *
   * @example
   * ```typescript
   * const run = await workflow.createRunAsync();
   * const { stream, getWorkflowState } = run.stream({ inputData: { value: 'hello' } });
   *
   * for await (const chunk of stream) {
   *   console.log(chunk);
   * }
   *
   * const result = await getWorkflowState();
   * console.log(result);
   * ```
   */
  stream({
    inputData,
    runtimeContext,
    onChunk,
    tracingContext,
    tracingOptions,
  }: {
    inputData?: z.input<TInput>;
    runtimeContext?: RuntimeContext;
    tracingContext?: TracingContext;
    onChunk?: (chunk: StreamEvent) => Promise<unknown>;
    tracingOptions?: TracingOptions;
  } = {}): {
    stream: ReadableStream<StreamEvent>;
    getWorkflowState: () => Promise<WorkflowResult<TInput, TOutput, TSteps>>;
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
   * Observe the workflow stream
   * @returns A readable stream of the workflow events
   *
   * Opens a new stream to an already running workflow run.
   *
   * @example
   * ```typescript
   * const run = await workflow.createRunAsync();
   * run.start({ inputData: { value: 'hello' } });
   * const { stream } = run.observeStream();
   *
   * for await (const chunk of stream) {
   *   console.log(chunk);
   * }
   * ```
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
   * Observe the workflow stream vnext
   * @returns A readable stream of the workflow events
   *
   * Opens a new stream to an already running workflow run.
   *
   * @example
   * ```typescript
   * const run = await workflow.createRunAsync();
   * run.start({ inputData: { value: 'hello' } });
   * const stream = run.observeStreamVNext();
   *
   * for await (const chunk of stream) {
   *   console.log(chunk);
   * }
   * ```
   */
  observeStreamVNext(): ReadableStream<ChunkType> {
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

    this.#observerHandlers.push(async () => {
      unwatch();
      try {
        await writable.close();
      } catch (err) {
        console.error('Error closing stream:', err);
      }
    });

    return readable;
  }

  /**@internal*/
  async streamAsync({
    inputData,
    runtimeContext,
  }: { inputData?: z.input<TInput>; runtimeContext?: RuntimeContext } = {}): Promise<{
    stream: ReadableStream<StreamEvent>;
    getWorkflowState: () => Promise<WorkflowResult<TInput, TOutput, TSteps>>;
  }> {
    return this.stream({ inputData, runtimeContext });
  }

  /**
   * Starts the workflow execution with the provided input and returns a stream of the workflow events.
   * @param inputData The input data for the workflow. The inputData structure is determined by the workflow inputSchema
   * @param runtimeContext The runtime context for the workflow.
   * @param tracingContext The tracing context for the workflow.
   * @param tracingOptions The tracing options for the workflow.
   * @param format The format of the stream.
   * @param closeOnSuspend Whether to close the stream when the workflow is suspended.
   * @param onChunk The callback function to handle the chunk. It will be called for each workflow event.
   * @returns A custom stream that extends ReadableStream<ChunkType>
   *
   * By default the stream closes when the workflow state becomes `success`, `failed` or `suspended`, but this can be changed by setting the `closeOnSuspend` parameter to `false` which will keep the stream open until the workflow is finished (by success or error).
   *
   * @example
   * ```typescript
   * const run = await workflow.createRunAsync();
   * const stream = run.streamVNext({ inputData: { value: 'hello' } });
   *
   * for await (const chunk of stream) {
   *   console.log(chunk);
   * }
   * ```
   */
  streamVNext({
    inputData,
    runtimeContext,
    tracingContext,
    tracingOptions,
    format,
    closeOnSuspend = true,
    onChunk,
  }: {
    inputData?: z.input<TInput>;
    runtimeContext?: RuntimeContext;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    format?: 'aisdk' | 'mastra' | undefined;
    closeOnSuspend?: boolean;
    onChunk?: (chunk: ChunkType) => Promise<unknown>;
  } = {}): MastraWorkflowStream<TInput, TOutput, TSteps> {
    if (this.closeStreamAction && this.activeStream) {
      return this.activeStream;
    }

    this.closeStreamAction = async () => {};

    this.activeStream = new MastraWorkflowStream<TInput, TOutput, TSteps>({
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
              if (onChunk) {
                await onChunk(chunk);
              }
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
          await Promise.all(this.#observerHandlers.map(handler => handler()));
          this.#observerHandlers = [];

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
          tracingOptions,
          writableStream: writable,
          format,
        }).then(result => {
          if (closeOnSuspend) {
            // always close stream, even if the workflow is suspended
            // this will trigger a finish event with workflow status set to suspended
            this.closeStreamAction?.().catch(() => {});
          } else if (result.status !== 'suspended') {
            this.closeStreamAction?.().catch(() => {});
          }

          return result;
        });
        this.executionResults = executionResults;

        return readable;
      },
    });

    return this.activeStream;
  }

  /**
   * Resumes the workflow execution with the provided resumeData and returns a stream of the workflow events.
   * @param resumeData The resume data for the workflow. The resumeData structure is determined by the resumeSchema of the step to resume.
   * @param step The step to resume. This can either be the step itself or the step id. For nested steps, you can pass an array of steps or step ids.
   * @param runtimeContext The runtime context for the workflow.
   * @param tracingContext The tracing context for the workflow.
   * @param tracingOptions The tracing options for the workflow.
   * @param format The format of the stream.
   * @param onChunk The callback function to handle the chunk. It will be called for each workflow event.
   * @returns A custom stream that extends ReadableStream<ChunkType>
   *
   * The stream only ends when the workflow state becomes `success` or `failed`. It remains open otherwise.
   *
   * @example
   * ```typescript
   * const myWorkflow = workflow.then(step1).then(step2).then(step3).commit(); step2 has a suspend call
   * const run = await myWorkflow.createRunAsync();
   * const stream = run.streamVNext({ inputData: { value: 'hello' } }); // the stream closes when step2 gets suspended
   *
   * for await (const chunk of stream) {
   *   console.log(chunk);
   * }
   * const resumedStream = run.resumeStreamVNext({ resumeData: { resume: 'world' }, step: 'step2' });
   *
   * for await (const chunk of resumedStream) {
   *   console.log(chunk);
   * }
   * ```
   *
   */
  resumeStreamVNext({
    step,
    resumeData,
    runtimeContext,
    tracingContext,
    tracingOptions,
    format,
    onChunk,
  }: {
    resumeData?: z.input<TInput>;
    step?:
      | Step<string, any, any, any, any, TEngineType>
      | [...Step<string, any, any, any, any, TEngineType>[], Step<string, any, any, any, any, TEngineType>]
      | string
      | string[];
    runtimeContext?: RuntimeContext;
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
    format?: 'aisdk' | 'mastra' | undefined;
    onChunk?: (chunk: ChunkType) => Promise<unknown>;
  } = {}) {
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
              if (onChunk) {
                await onChunk(chunk);
              }
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
          await Promise.all(this.#observerHandlers.map(handler => handler()));
          this.#observerHandlers = [];

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
          tracingOptions,
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

  /**
   * Resumes the workflow execution with the provided resumeData and returns a promise that resolves to the workflow output.
   * @param params The parameters for the resume.
   * @param params.resumeData The resume data for the workflow. The resumeData structure is determined by the resumeSchema of the step to resume.
   * @param params.step The step to resume. This can either be the step itself or the step id. For nested steps, you can pass an array of steps or step ids.
   * @param params.runtimeContext The runtime context for the workflow.
   * @param params.runCount The run count for the workflow.
   * @param params.tracingContext The tracing context for the workflow.
   * @param params.tracingOptions The tracing options for the workflow.
   * @param params.writableStream The writable stream for the workflow.
   * @returns A promise that resolves to the workflow output
   *
   * @example
   * ```typescript
   * const myWorkflow = workflow.then(step1).then(step2).then(step3).commit(); step2 has a suspend call
   * const run = await myWorkflow.createRunAsync();
   * const result = await run.start({ inputData: { value: 'hello' } });
   * console.log(result);
   * if (result.status === 'suspended') {
   *   const resumedResult = await run.resume({ resumeData: { resume: 'world' }, step: 'step2' });
   *   console.log(resumedResult);
   * }
   * ```
   */
  async resume<TResumeSchema extends z.ZodType<any>>(params: {
    resumeData?: z.input<TResumeSchema>;
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
  }): Promise<WorkflowResult<TInput, TOutput, TSteps>> {
    return this._resume(params);
  }

  protected async _resume<TResumeSchema extends z.ZodType<any>>(params: {
    resumeData?: z.input<TResumeSchema>;
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
  }): Promise<WorkflowResult<TInput, TOutput, TSteps>> {
    const snapshot = await this.#mastra?.getStorage()?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    if (!snapshot) {
      throw new Error('No snapshot found for this workflow run: ' + this.workflowId + ' ' + this.runId);
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

    const suspendedStep = this.workflowSteps[steps?.[0] ?? ''];

    const resumeDataToUse = await this._validateResumeData(params.resumeData, suspendedStep);

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
      input: resumeDataToUse,
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
      .execute<z.infer<TInput>, WorkflowResult<TInput, TOutput, TSteps>>({
        workflowId: this.workflowId,
        runId: this.runId,
        resourceId: this.resourceId,
        graph: this.executionGraph,
        serializedStepGraph: this.serializedStepGraph,
        input: snapshot?.context?.input,
        resume: {
          steps,
          stepResults,
          resumePayload: resumeDataToUse,
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
   * @internal
   * Returns the current state of the workflow run
   * @returns The current state of the workflow run
   */
  protected getState(): Record<string, any> {
    return this.state;
  }

  /**
   * @internal
   * Updates the state of the workflow run
   * @param state The state to update
   */
  protected updateState(state: Record<string, any>) {
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
  _getExecutionResults(): Promise<WorkflowResult<TInput, TOutput, TSteps>> | undefined {
    return this.executionResults;
  }
}

/**@internal */
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
