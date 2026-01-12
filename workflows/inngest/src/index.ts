import type { ReadableStream } from 'node:stream/web';
import { Agent } from '@mastra/core/agent';
import type { MastraScorers } from '@mastra/core/evals';
import type { Processor, ProcessorStepOutputSchema, ProcessorStepSchema } from '@mastra/core/processors';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { Tool } from '@mastra/core/tools';
import type { DynamicArgument } from '@mastra/core/types';
import type { Step, AgentStepOptions, StepParams, ToolStep } from '@mastra/core/workflows';
import { Workflow } from '@mastra/core/workflows';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '@mastra/core/workflows/_constants';
import type { Inngest } from 'inngest';
import { z } from 'zod';
import type { InferSchemaOutput } from '../../../packages/core/dist/stream/base/schema';
import type { InngestEngineType, InngestWorkflowConfig } from './types';
import { InngestWorkflow } from './workflow';

export * from './workflow';
export * from './execution-engine';
export * from './pubsub';
export * from './run';
export * from './serve';
export * from './types';

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
export function createStep<TStepId extends string, TState, TStepInput, TStepOutput, TResume, TSuspend>(
  params: StepParams<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend>,
): Step<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend, InngestEngineType>;

// Overload for agent WITH structured output schema
export function createStep<TStepId extends string, TStepOutput>(
  agent: Agent<TStepId, any>,
  agentOptions: AgentStepOptions<TStepOutput> & {
    structuredOutput: { schema: TStepOutput };
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
  },
): Step<TStepId, unknown, { prompt: string }, TStepOutput, unknown, unknown, InngestEngineType>;

// Overload for agent WITHOUT structured output (default { text: string })
export function createStep<
  TStepId extends string,
  TStepInput extends { prompt: string },
  TStepOutput extends { text: string },
  TResume,
  TSuspend,
>(
  agent: Agent<TStepId, any>,
  agentOptions?: AgentStepOptions<TStepOutput> & {
    retries?: number;
    scorers?: DynamicArgument<MastraScorers>;
  },
): Step<TStepId, any, TStepInput, TStepOutput, TResume, TSuspend, InngestEngineType>;

export function createStep<
  TSchemaIn,
  TSuspend,
  TResume,
  TSchemaOut,
  TContext extends ToolExecutionContext<TSuspend, TResume>,
>(
  tool: ToolStep<TSchemaIn, TSuspend, TResume, TSchemaOut, TContext>,
  toolOptions?: { retries?: number; scorers?: DynamicArgument<MastraScorers> },
): Step<string, any, TSchemaIn, TSchemaOut, TSuspend, TResume, InngestEngineType>;

export function createStep<TStepId extends string, TState, TStepInput, TStepOutput, TResume, TSuspend>(
  params:
    | StepParams<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend>
    | Agent<any, any>
    | ToolStep<TStepInput, TSuspend, TResume, TStepOutput, any>,
  agentOrToolOptions?:
    | (AgentStepOptions<TStepOutput> & {
        retries?: number;
        scorers?: DynamicArgument<MastraScorers>;
      })
    | {
        retries?: number;
        scorers?: DynamicArgument<MastraScorers>;
      },
): Step<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend, InngestEngineType> {
  // Issue #9965: Preserve InngestWorkflow identity when passed to createStep
  // This ensures nested workflows in foreach are properly detected by isNestedWorkflowStep()
  if (params instanceof InngestWorkflow) {
    return params as unknown as Step<TStepId, TState, TStepInput, TStepOutput, TResume, TSuspend, InngestEngineType>;
  }

  if (params instanceof Agent) {
    const options = agentOrToolOptions as
      | (AgentStepOptions<TStepOutput> & { retries?: number; scorers?: DynamicArgument<MastraScorers> })
      | undefined;
    // Determine output schema based on structuredOutput option
    const outputSchema = options?.structuredOutput?.schema ?? z.object({ text: z.string() });
    const { retries, scorers, ...agentOptions } = options ?? {};
    return {
      id: params.name as TStepId,
      description: params.getDescription(),
      // @ts-ignore fix types
      inputSchema: z.object({
        prompt: z.string(),
        // resourceId: z.string().optional(),
        // threadId: z.string().optional(),
      }),
      // @ts-ignore
      outputSchema,
      retries,
      scorers,
      execute: async ({
        inputData,
        runId,
        [PUBSUB_SYMBOL]: pubsub,
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

        // Track structured output result
        let structuredResult: any = null;

        const toolData = {
          name: params.name,
          args: inputData,
        };

        let stream: ReadableStream<any>;

        if ((await params.getModel()).specificationVersion === 'v1') {
          const { fullStream } = await params.streamLegacy((inputData as { prompt: string }).prompt, {
            ...(agentOptions ?? {}),
            // resourceId: (inputData as { prompt: string }).resourceId,
            // threadId: inputData.threadId,
            requestContext,
            tracingContext,
            onFinish: result => {
              // Capture structured output if available
              const resultWithObject = result as typeof result & { object?: unknown };
              if (agentOptions?.structuredOutput?.schema && resultWithObject.object) {
                structuredResult = resultWithObject.object;
              }
              streamPromise.resolve(result.text);
              void agentOptions?.onFinish?.(result);
            },
            abortSignal,
          });
          stream = fullStream as any;
        } else {
          const modelOutput = await params.stream((inputData as { prompt: string }).prompt, {
            ...(agentOptions ?? {}),
            requestContext,
            tracingContext,
            onFinish: result => {
              // Capture structured output if available
              const resultWithObject = result as typeof result & { object?: unknown };
              if (agentOptions?.structuredOutput?.schema && resultWithObject.object) {
                structuredResult = resultWithObject.object;
              }
              streamPromise.resolve(result.text);
              void agentOptions?.onFinish?.(result);
            },
            abortSignal,
          });

          stream = modelOutput.fullStream;
        }

        if (streamFormat === 'legacy') {
          await pubsub.publish(`workflow.events.v2.${runId}`, {
            type: 'watch',
            runId,
            data: { type: 'tool-call-streaming-start', ...(toolData ?? {}) },
          });
          for await (const chunk of stream) {
            if (chunk.type === 'text-delta') {
              await pubsub.publish(`workflow.events.v2.${runId}`, {
                type: 'watch',
                runId,
                data: { type: 'tool-call-delta', ...(toolData ?? {}), argsTextDelta: chunk.textDelta },
              });
            }
          }
          await pubsub.publish(`workflow.events.v2.${runId}`, {
            type: 'watch',
            runId,
            data: { type: 'tool-call-streaming-finish', ...(toolData ?? {}) },
          });
        } else {
          for await (const chunk of stream) {
            await writer.write(chunk as any);
          }
        }

        if (abortSignal.aborted) {
          return abort();
        }

        // Return structured output if available, otherwise default text
        if (structuredResult !== null) {
          return structuredResult;
        }
        return {
          text: await streamPromise.promise,
        };
      },
      component: params.component,
    };
  }

  if (params instanceof Tool) {
    const toolOpts = agentOrToolOptions as { retries?: number; scorers?: DynamicArgument<MastraScorers> } | undefined;
    if (!params.inputSchema || !params.outputSchema) {
      throw new Error('Tool must have input and output schemas defined');
    }

    return {
      // TODO: tool probably should have strong id type
      id: params.id as unknown as TStepId,
      description: params.description,
      inputSchema: params.inputSchema,
      outputSchema: params.outputSchema,
      suspendSchema: params.suspendSchema,
      resumeSchema: params.resumeSchema,
      retries: toolOpts?.retries,
      scorers: toolOpts?.scorers,
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
          workflow: {
            runId,
            resumeData,
            suspend,
            workflowId,
            state,
            setState,
          },
        };
        return params.execute(inputData, toolContext) as TStepOutput;
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
    retries: params.retries,
    scorers: params.scorers,
    execute: params.execute,
  };
}

export function init(inngest: Inngest) {
  return {
    createWorkflow<
      TWorkflowId extends string = string,
      TState = any,
      TInput = any,
      TOutput = any,
      TSteps extends Step<string, any, any, any, any, any, InngestEngineType>[] = Step<
        string,
        any,
        any,
        any,
        any,
        any,
        InngestEngineType
      >[],
    >(params: InngestWorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>) {
      return new InngestWorkflow<InngestEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TInput>(
        params,
        inngest,
      );
    },
    createStep,
    cloneStep<TStepId extends string>(
      step: Step<TStepId, any, any, any, any, any, InngestEngineType>,
      opts: { id: TStepId },
    ): Step<TStepId, any, any, any, any, any, InngestEngineType> {
      return {
        id: opts.id,
        description: step.description,
        inputSchema: step.inputSchema,
        outputSchema: step.outputSchema,
        resumeSchema: step.resumeSchema,
        suspendSchema: step.suspendSchema,
        stateSchema: step.stateSchema,
        execute: step.execute,
        retries: step.retries,
        scorers: step.scorers,
        component: step.component,
      };
    },
    cloneWorkflow<
      TWorkflowId extends string = string,
      TState = unknown,
      TInput = unknown,
      TOutput = unknown,
      TSteps extends Step<string, any, any, any, any, any, InngestEngineType>[] = Step<
        string,
        any,
        any,
        any,
        any,
        any,
        InngestEngineType
      >[],
      TPrev = TInput,
    >(
      workflow: Workflow<InngestEngineType, TSteps, string, TState, TInput, TOutput, TPrev>,
      opts: { id: TWorkflowId },
    ): Workflow<InngestEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrev> {
      const wf: Workflow<InngestEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrev> = new Workflow({
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
    },
  };
}
