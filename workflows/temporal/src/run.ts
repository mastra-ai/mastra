import type { RequestContext } from '@mastra/core/di';
import { Run } from '@mastra/core/workflows';
import type { Step, WorkflowResult, WorkflowRunStartOptions } from '@mastra/core/workflows';
import type { Client } from '@temporalio/client';
import type { TemporalEngineType } from './types';
import { toWorkflowType } from './utils';

type TemporalRunStartArgs<TState, TInput, TRequestContext> = {
  inputData?: TInput;
  initialState?: TState;
  requestContext?: RequestContext<TRequestContext>;
} & WorkflowRunStartOptions;

export class TemporalRun<
  TSteps extends Step<string, any, any, any, any, any, TemporalEngineType, any>[] = Step<
    string,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    TemporalEngineType
  >[],
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TRequestContext extends Record<string, any> | unknown = unknown,
> extends Run<TemporalEngineType, TSteps, TState, TInput, TOutput, TRequestContext> {
  private readonly client: Client;
  private readonly taskQueue: string;

  constructor(
    params: ConstructorParameters<typeof Run<TemporalEngineType, TSteps, TState, TInput, TOutput, TRequestContext>>[0],
    temporalParams: {
      client: Client;
      taskQueue: string;
    },
  ) {
    super(params);

    this.client = temporalParams.client;
    this.taskQueue = temporalParams.taskQueue;
  }

  async start(args: TemporalRunStartArgs<TState, TInput, TRequestContext> = {}) {
    const input = await this._validateInput(args.inputData);
    const initialState = await this._validateInitialState(args.initialState);
    await this._validateRequestContext(args.requestContext as RequestContext<unknown> | undefined);

    try {
      const handle = await this.client.workflow.start(toWorkflowType(this.workflowId), {
        taskQueue: this.taskQueue,
        workflowId: this.runId,
        args: [
          {
            inputData: input,
            initialState,
            requestContext: args.requestContext ? Object.fromEntries(args.requestContext.entries()) : {},
            runId: this.runId,
            resourceId: this.resourceId,
            outputOptions: args.outputOptions,
            tracingOptions: args.tracingOptions,
            perStep: args.perStep,
          },
        ],
      });
      const result = await handle.result();

      return {
        status: 'success',
        input: input as TInput,
        result: result as TOutput,
        state: initialState,
        steps: {},
      } as WorkflowResult<TState, TInput, TOutput, TSteps>;
    } catch (error) {
      return {
        status: 'failed',
        input: input as TInput,
        error: error instanceof Error ? error : new Error(String(error)),
        state: initialState,
        steps: {},
      } as WorkflowResult<TState, TInput, TOutput, TSteps>;
    }
  }

  async startAsync(args: TemporalRunStartArgs<TState, TInput, TRequestContext> = {}) {
    const input = await this._validateInput(args.inputData);
    const initialState = await this._validateInitialState(args.initialState);
    await this._validateRequestContext(args.requestContext as RequestContext<unknown> | undefined);

    await this.client.workflow.start(toWorkflowType(this.workflowId), {
      taskQueue: this.taskQueue,
      workflowId: this.runId,
      args: [
        {
          inputData: input,
          initialState,
          requestContext: args.requestContext ? Object.fromEntries(args.requestContext.entries()) : {},
          runId: this.runId,
          resourceId: this.resourceId,
          outputOptions: args.outputOptions,
          tracingOptions: args.tracingOptions,
          perStep: args.perStep,
        },
      ],
    });

    return { runId: this.runId };
  }
}
