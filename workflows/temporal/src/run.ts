import { RequestContext } from '@mastra/core/di';
import { Run } from '@mastra/core/workflows';
import type { Step, WorkflowResult, WorkflowRunStartOptions } from '@mastra/core/workflows';
import type { Client, WorkflowHandle } from '@temporalio/client';
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
    const requestContext = (args.requestContext ?? new RequestContext()) as RequestContext;
    await this.invokeStartCallback(input, initialState, requestContext);

    let handle: WorkflowHandle;
    try {
      handle = await this.dispatch(args, input, initialState, requestContext);
    } catch (error) {
      const result = this.failedResult(input, initialState, error);
      await this.invokeLifecycleCallbacks(result, requestContext);
      return result;
    }

    return this.awaitResult(handle, input, initialState, requestContext);
  }

  private dispatch(
    args: TemporalRunStartArgs<TState, TInput, TRequestContext>,
    input: unknown,
    initialState: unknown,
    requestContext: RequestContext,
  ): Promise<WorkflowHandle> {
    return this.client.workflow.start(toWorkflowType(this.workflowId), {
      taskQueue: this.taskQueue,
      workflowId: this.runId,
      args: [
        {
          inputData: input,
          initialState,
          requestContext: Object.fromEntries(requestContext.entries()),
          runId: this.runId,
          resourceId: this.resourceId,
          outputOptions: args.outputOptions,
          tracingOptions: args.tracingOptions,
          perStep: args.perStep,
        },
      ],
    });
  }

  private async awaitResult(
    handle: WorkflowHandle,
    input: unknown,
    initialState: unknown,
    requestContext: RequestContext,
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    let result: WorkflowResult<TState, TInput, TOutput, TSteps>;
    try {
      // The generated Temporal workflow returns the execution result ({ status, result, state, steps }).
      const output = (await handle.result()) as WorkflowResult<TState, TInput, TOutput, TSteps>;
      result = {
        ...output,
        input: input as TInput,
        steps: normalizeStepResults(output.steps),
      } as WorkflowResult<TState, TInput, TOutput, TSteps>;
    } catch (error) {
      result = this.failedResult(input, initialState, error);
    }

    await this.invokeLifecycleCallbacks(result, requestContext);
    return result;
  }

  private failedResult(input: unknown, initialState: unknown, error: unknown) {
    return {
      status: 'failed',
      input: input as TInput,
      error: error instanceof Error ? error : new Error(String(error)),
      state: initialState,
      steps: {},
    } as WorkflowResult<TState, TInput, TOutput, TSteps>;
  }

  // Lifecycle hooks are closures that cannot run inside the deterministic Temporal workflow
  // sandbox, so they run here in the process that started the run, using core hook semantics.
  private invokeStartCallback(input: unknown, initialState: unknown, requestContext: RequestContext) {
    return this.executionEngine.invokeStartCallback({
      runId: this.runId,
      workflowId: this.workflowId,
      resourceId: this.resourceId,
      getInitData: () => input,
      requestContext,
      state: (initialState ?? {}) as Record<string, any>,
    });
  }

  private invokeLifecycleCallbacks(
    result: WorkflowResult<TState, TInput, TOutput, TSteps>,
    requestContext: RequestContext,
  ) {
    return this.executionEngine.invokeLifecycleCallbacks({
      status: result.status,
      result: result.status === 'success' ? result.result : undefined,
      error: result.status === 'failed' ? result.error : undefined,
      steps: result.steps,
      runId: this.runId,
      workflowId: this.workflowId,
      resourceId: this.resourceId,
      input: result.input,
      requestContext,
      state: (result.state ?? {}) as Record<string, any>,
    });
  }

  async cancel() {
    await this.client.workflow.getHandle(this.runId).cancel();
    await super.cancel();
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
    const requestContext = (args.requestContext ?? new RequestContext()) as RequestContext;
    await this.invokeStartCallback(input, initialState, requestContext);

    let handle: WorkflowHandle;
    try {
      handle = await this.dispatch(args, input, initialState, requestContext);
    } catch (error) {
      await this.invokeLifecycleCallbacks(this.failedResult(input, initialState, error), requestContext);
      throw error;
    }

    const { onFinish, onError } = this.executionEngine.options;
    if (onFinish || onError) {
      // Like core startAsync(), terminal hooks fire in the background from this process.
      // They are best-effort: if this process exits before the run ends, they do not fire.
      void this.awaitResult(handle, input, initialState, requestContext);
    }

    return { runId: this.runId };
  }
}

// The worker only records successful steps; a failed run rejects handle.result() instead.
function isStepResult(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.status === 'success' &&
    'payload' in record &&
    'output' in record &&
    typeof record.startedAt === 'number' &&
    typeof record.endedAt === 'number'
  );
}

// Workers built before step results used the core StepResult shape return raw step outputs.
function normalizeStepResults<T>(steps: T): T {
  if (!steps || typeof steps !== 'object') {
    return {} as T;
  }
  return Object.fromEntries(
    Object.entries(steps).map(([id, value]) => [
      id,
      isStepResult(value) ? value : { status: 'success', output: value, startedAt: 0, endedAt: 0 },
    ]),
  ) as T;
}
