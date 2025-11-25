import z from 'zod';
import type { Agent } from '../../agent';
import { Tool } from '../../tools';
import type { ToolExecutionContext } from '../../tools/types';
import { Workflow } from '../../workflows';
import type { ExecuteFunction, Step } from '../../workflows/step';
import type { WorkflowConfig } from '../../workflows/types';
import { EMITTER_SYMBOL } from '../constants';
import { EventedWorkflow } from './evented-workflow';
import type { EventedEngineType } from './evented-workflow';
import { EventedExecutionEngine } from './execution-engine';
import { WorkflowEventProcessor } from './workflow-event-processor';

export function cloneWorkflow<
  TWorkflowId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any, EventedEngineType>[] = Step<
    string,
    any,
    any,
    any,
    any,
    any,
    EventedEngineType
  >[],
  TPrevSchema extends z.ZodType<any> = TInput,
>(
  workflow: Workflow<EventedEngineType, TSteps, string, TState, TInput, TOutput, TPrevSchema>,
  opts: { id: TWorkflowId },
): Workflow<EventedEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> {
  const wf: Workflow<EventedEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> = new Workflow({
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

export function cloneStep<TStepId extends string>(
  step: Step<string, any, any, any, any, any, EventedEngineType>,
  opts: { id: TStepId },
): Step<TStepId, any, any, any, any, any, EventedEngineType> {
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
>(params: {
  id: TStepId;
  description?: string;
  inputSchema: TStepInput;
  outputSchema: TStepOutput;
  resumeSchema?: TResumeSchema;
  suspendSchema?: TSuspendSchema;
  execute: ExecuteFunction<
    z.infer<TState>,
    z.infer<TStepInput>,
    z.infer<TStepOutput>,
    z.infer<TResumeSchema>,
    z.infer<TSuspendSchema>,
    EventedEngineType
  >;
}): Step<TStepId, TState, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, EventedEngineType>;

export function createStep<
  TStepId extends string,
  TState extends z.ZodObject<any>,
  TStepInput extends z.ZodObject<{ prompt: z.ZodString }>,
  TStepOutput extends z.ZodObject<{ text: z.ZodString }>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(
  agent: Agent<TStepId, any>,
): Step<TStepId, TState, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, EventedEngineType>;

export function createStep<
  TSchemaIn extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
  TContext extends ToolExecutionContext<TSuspendSchema, TResumeSchema>,
>(
  tool: Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> & {
    inputSchema: TSchemaIn;
    outputSchema: TSchemaOut;
    execute: (input: z.infer<TSchemaIn>, context?: TContext) => Promise<any>;
  },
): Step<string, any, TSchemaIn, TSchemaOut, z.ZodType<any>, z.ZodType<any>, EventedEngineType>;

export function createStep<
  TStepId extends string,
  TState extends z.ZodObject<any>,
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
          z.infer<TState>,
          z.infer<TStepInput>,
          z.infer<TStepOutput>,
          z.infer<TResumeSchema>,
          z.infer<TSuspendSchema>,
          EventedEngineType
        >;
      }
    | Agent<any, any>
    | (Tool<TStepInput, TStepOutput, TSuspendSchema, TResumeSchema, any> & {
        inputSchema: TStepInput;
        outputSchema: TStepOutput;
        execute: (
          input: z.infer<TStepInput>,
          context?: ToolExecutionContext<TSuspendSchema, TResumeSchema>,
        ) => Promise<any>;
      }),
): Step<TStepId, TState, TStepInput, TStepOutput, TResumeSchema, TSuspendSchema, EventedEngineType> {
  if (isAgent(params)) {
    return {
      id: params.id,
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
      execute: async ({ inputData, [EMITTER_SYMBOL]: emitter, requestContext, abortSignal, abort }) => {
        // TODO: support stream
        let streamPromise = {} as {
          promise: Promise<string>;
          resolve: (value: string) => void;
          reject: (reason?: any) => void;
        };

        streamPromise.promise = new Promise((resolve, reject) => {
          streamPromise.resolve = resolve;
          streamPromise.reject = reject;
        });
        // TODO: should use regular .stream()
        const { fullStream } = await params.streamLegacy(inputData.prompt, {
          // resourceId: inputData.resourceId,
          // threadId: inputData.threadId,
          requestContext,
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

        await emitter.emit('watch', {
          type: 'tool-call-streaming-start',
          ...(toolData ?? {}),
        });
        for await (const chunk of fullStream) {
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
      id: params.id as TStepId,
      description: params.description,
      inputSchema: params.inputSchema,
      outputSchema: params.outputSchema,
      suspendSchema: params.suspendSchema,
      resumeSchema: params.resumeSchema,
      execute: async ({
        inputData,
        mastra,
        requestContext,
        suspend,
        resumeData,
        runId,
        workflowId,
        state,
        setState,
      }) => {
        // Tools receive (input, context) - just call the tool's execute
        if (!params.execute) {
          throw new Error(`Tool ${params.id} does not have an execute function`);
        }

        // Build context matching ToolExecutionContext structure
        const context = {
          mastra,
          requestContext,
          tracingContext: { currentSpan: undefined }, // TODO: Pass proper tracing context when evented workflows support tracing
          workflow: {
            runId,
            workflowId,
            state,
            setState,
            suspend,
            resumeData,
          },
        };

        // Tool.execute already handles the v1.0 signature properly
        return params.execute(inputData, context);
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

export function createWorkflow<
  TWorkflowId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any, EventedEngineType>[] = Step<
    string,
    any,
    any,
    any,
    any,
    any,
    EventedEngineType
  >[],
>(params: WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>) {
  const eventProcessor = new WorkflowEventProcessor({ mastra: params.mastra! });
  const executionEngine = new EventedExecutionEngine({
    mastra: params.mastra!,
    eventProcessor,
    options: {
      validateInputs: params.options?.validateInputs ?? true,
      shouldPersistSnapshot: params.options?.shouldPersistSnapshot ?? (() => true),
      tracingPolicy: params.options?.tracingPolicy,
    },
  });
  return new EventedWorkflow<EventedEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TInput>({
    ...params,
    executionEngine,
  });
}
