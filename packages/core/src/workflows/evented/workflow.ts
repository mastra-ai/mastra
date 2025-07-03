import z from 'zod';
import { Workflow, Agent, Tool } from '../..';
import type { ExecuteFunction, Step, ToolExecutionContext, WorkflowConfig } from '../..';
import { EventEmitterPubSub } from '../../events/event-emitter';
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
  const executionEngine = new EventedExecutionEngine({ mastra: params.mastra!, eventProcessor });
  return new Workflow<EventedEngineType, TSteps, TWorkflowId, TInput, TOutput, TInput>({
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
> extends Workflow<TEngineType, TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> {}
