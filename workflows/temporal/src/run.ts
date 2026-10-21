import type { RequestContext } from '@mastra/core/di';
import { MASTRA_AUTH_TOKEN_KEY } from '@mastra/core/request-context';
import { Run } from '@mastra/core/workflows';
import type {
  Step,
  StepResult,
  WorkflowResult,
  WorkflowRunStartOptions,
  WorkflowRunState,
} from '@mastra/core/workflows';
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
    const requestContext = this.serializeRequestContext(args.requestContext as RequestContext<unknown> | undefined);

    await this.persistSnapshot({ status: 'running', input, state: initialState, requestContext });

    try {
      const handle = await this.client.workflow.start(toWorkflowType(this.workflowId), {
        taskQueue: this.taskQueue,
        workflowId: this.runId,
        args: [
          {
            inputData: input,
            initialState,
            requestContext,
            runId: this.runId,
            resourceId: this.resourceId,
            outputOptions: args.outputOptions,
            tracingOptions: args.tracingOptions,
            perStep: args.perStep,
          },
        ],
      });
      const result = (await handle.result()) as WorkflowResult<TState, TInput, TOutput, TSteps>;
      await this.persistSnapshot({
        status: 'success',
        input,
        result: (result as any).result as Record<string, any>,
        state: result.state ?? initialState,
        steps: result.steps as Record<string, StepResult<any, any, any, any>>,
        requestContext,
      });

      return result;
    } catch (error) {
      const workflowError = error instanceof Error ? error : new Error(String(error));
      await this.persistSnapshot({
        status: 'failed',
        input,
        state: initialState,
        error: workflowError,
        requestContext,
      });

      return {
        status: 'failed',
        input: input as TInput,
        error: workflowError,
        state: initialState,
        steps: {},
      } as WorkflowResult<TState, TInput, TOutput, TSteps>;
    }
  }

  async cancel() {
    await this.client.workflow.getHandle(this.runId).cancel();
    await super.cancel();
  }

  private serializeRequestContext(requestContext?: RequestContext<unknown>) {
    const serialized = requestContext?.toJSON() ?? {};
    delete serialized[MASTRA_AUTH_TOKEN_KEY];
    return serialized;
  }

  private async persistSnapshot({
    status,
    input,
    state,
    result,
    steps = {},
    error,
    requestContext,
  }: {
    status: WorkflowRunState['status'];
    input: unknown;
    state: unknown;
    result?: Record<string, any>;
    steps?: Record<string, StepResult<any, any, any, any>>;
    error?: Error;
    requestContext: Record<string, any>;
  }) {
    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    await workflowsStore?.persistWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      snapshot: {
        runId: this.runId,
        status,
        value: (state ?? {}) as Record<string, string>,
        context: {
          input: input as Record<string, any>,
          __state: state,
          ...steps,
        } as unknown as WorkflowRunState['context'],
        activePaths: [],
        activeStepsPath: {},
        waitingPaths: {},
        serializedStepGraph: this.serializedStepGraph,
        suspendedPaths: {},
        resumeLabels: {},
        result,
        error: error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
        requestContext,
        timestamp: Date.now(),
      },
    });
  }

  private unsupported(method: string): never {
    throw new Error(`@mastra/temporal does not support ${method}() yet. Use start() or startAsync() instead.`);
  }

  override stream(
    ..._args: Parameters<Run<TemporalEngineType, TSteps, TState, TInput, TOutput, TRequestContext>['stream']>
  ): never {
    return this.unsupported('stream');
  }

  override streamLegacy(
    ..._args: Parameters<Run<TemporalEngineType, TSteps, TState, TInput, TOutput, TRequestContext>['streamLegacy']>
  ): never {
    return this.unsupported('streamLegacy');
  }

  override resumeStream(..._args: unknown[]): never {
    return this.unsupported('resumeStream');
  }

  override resume(..._args: unknown[]): never {
    return this.unsupported('resume');
  }

  override resumeAsync(..._args: unknown[]): never {
    return this.unsupported('resumeAsync');
  }

  override restart(
    ..._args: Parameters<Run<TemporalEngineType, TSteps, TState, TInput, TOutput, TRequestContext>['restart']>
  ): never {
    return this.unsupported('restart');
  }

  override timeTravel(..._args: unknown[]): never {
    return this.unsupported('timeTravel');
  }

  override timeTravelStream(..._args: unknown[]): never {
    return this.unsupported('timeTravelStream');
  }

  async startAsync(args: TemporalRunStartArgs<TState, TInput, TRequestContext> = {}) {
    const input = await this._validateInput(args.inputData);
    const initialState = await this._validateInitialState(args.initialState);
    await this._validateRequestContext(args.requestContext as RequestContext<unknown> | undefined);
    const requestContext = this.serializeRequestContext(args.requestContext as RequestContext<unknown> | undefined);

    await this.persistSnapshot({ status: 'running', input, state: initialState, requestContext });

    let handle;
    try {
      handle = await this.client.workflow.start(toWorkflowType(this.workflowId), {
        taskQueue: this.taskQueue,
        workflowId: this.runId,
        args: [
          {
            inputData: input,
            initialState,
            requestContext,
            runId: this.runId,
            resourceId: this.resourceId,
            outputOptions: args.outputOptions,
            tracingOptions: args.tracingOptions,
            perStep: args.perStep,
          },
        ],
      });
    } catch (error) {
      const workflowError = error instanceof Error ? error : new Error(String(error));
      await this.persistSnapshot({
        status: 'failed',
        input,
        state: initialState,
        error: workflowError,
        requestContext,
      });
      throw error;
    }

    void (async () => {
      let workflowResult: WorkflowResult<TState, TInput, TOutput, TSteps>;
      try {
        workflowResult = (await handle.result()) as WorkflowResult<TState, TInput, TOutput, TSteps>;
      } catch (error) {
        const workflowError = error instanceof Error ? error : new Error(String(error));
        await this.persistSnapshot({
          status: 'failed',
          input,
          state: initialState,
          error: workflowError,
          requestContext,
        });
        this.mastra?.getLogger()?.error('Background Temporal workflow execution failed', {
          error: workflowError,
          runId: this.runId,
          workflowId: this.workflowId,
        });
        return;
      }

      await this.persistSnapshot({
        status: 'success',
        input,
        result: (workflowResult as any).result as Record<string, any>,
        state: workflowResult.state ?? initialState,
        steps: workflowResult.steps as Record<string, StepResult<any, any, any, any>>,
        requestContext,
      });
    })().catch(error => {
      this.mastra?.getLogger()?.error('Failed to persist background Temporal workflow result', {
        error,
        runId: this.runId,
        workflowId: this.workflowId,
      });
    });

    return { runId: this.runId };
  }
}
