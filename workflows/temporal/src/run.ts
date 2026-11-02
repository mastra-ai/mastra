import { RequestContext } from '@mastra/core/di';
import { Run } from '@mastra/core/workflows';
import type { Step, StepResult, WorkflowResult, WorkflowRunStartOptions } from '@mastra/core/workflows';
import { CancelledFailure, WorkflowFailedError } from '@temporalio/client';
import type { Client, WorkflowHandle } from '@temporalio/client';
import type { WorkflowExecutionResult } from './transforms/temporal-workflow-runtime';
import type { TemporalEngineType } from './types';
import { toWorkflowType } from './utils';

// Builds Mastra step records from the Temporal result. Iterates `stepMeta` rather than `steps`
// because a step that returned undefined has no key in `steps` once serialized. A result without
// `stepMeta` came from a Worker that predates it, so `steps` stays empty instead of guessing times.
function toStepResults(input: unknown, { steps, stepMeta }: WorkflowExecutionResult): Record<string, unknown> {
  if (!stepMeta) {
    return {};
  }

  const records: Record<string, unknown> = { input };
  for (const [stepId, times] of Object.entries(stepMeta)) {
    records[stepId] = { status: 'success', output: steps[stepId], ...times };
  }
  return records;
}

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
    const requestContext = await this.#invokeStartCallback(args.requestContext, input, initialState);

    const result = await this.#settle(
      this.client.workflow.start(toWorkflowType(this.workflowId), {
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
            recordStepMeta: true,
            validateInputs: this.validateInputs,
          },
        ],
      }),
      input,
      initialState,
    );

    await this.#invokeFinishCallbacks(result, input, requestContext);
    return result;
  }

  // Lifecycle hooks are closures that cannot run in the Temporal workflow sandbox, so they run
  // in the process that starts the run. Returns the context to send, since onStart can change it.
  async #invokeStartCallback(
    requestContext: RequestContext<TRequestContext> | undefined,
    input: TInput | undefined,
    initialState: TState | undefined,
  ) {
    const context = (requestContext ?? new RequestContext()) as RequestContext;
    await this.executionEngine.invokeStartCallback({
      runId: this.runId,
      workflowId: this.workflowId,
      resourceId: this.resourceId,
      getInitData: () => input,
      requestContext: context,
      state: (initialState ?? {}) as Record<string, any>,
    });
    return context;
  }

  async #settle(
    handle: WorkflowHandle | Promise<WorkflowHandle>,
    input: TInput | undefined,
    initialState: TState | undefined,
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    try {
      const result = (await (await handle).result()) as WorkflowExecutionResult;

      return {
        status: 'success',
        input: input as TInput,
        result: result.result as TOutput,
        state: initialState,
        steps: toStepResults(input, result),
      } as WorkflowResult<TState, TInput, TOutput, TSteps>;
    } catch (error) {
      // Core reports a canceled run as `canceled` and does not call onError for it.
      if (error instanceof WorkflowFailedError && error.cause instanceof CancelledFailure) {
        return { status: 'canceled', input, state: initialState, steps: {} } as unknown as WorkflowResult<
          TState,
          TInput,
          TOutput,
          TSteps
        >;
      }

      return {
        status: 'failed',
        input: input as TInput,
        error: error instanceof Error ? error : new Error(String(error)),
        state: initialState,
        steps: {},
      } as WorkflowResult<TState, TInput, TOutput, TSteps>;
    }
  }

  #invokeFinishCallbacks(
    result: WorkflowResult<TState, TInput, TOutput, TSteps>,
    input: TInput | undefined,
    requestContext: RequestContext,
  ) {
    return this.executionEngine.invokeLifecycleCallbacks({
      status: result.status,
      result: result.status === 'success' ? result.result : undefined,
      error: result.status === 'failed' ? result.error : undefined,
      steps: result.steps as Record<string, StepResult<any, any, any, any>>,
      runId: this.runId,
      workflowId: this.workflowId,
      resourceId: this.resourceId,
      input,
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
    const requestContext = await this.#invokeStartCallback(args.requestContext, input, initialState);
    const { onFinish, onError } = this.executionEngine.options;
    const hasFinishCallbacks = Boolean(onFinish || onError);

    const handle = await this.client.workflow.start(toWorkflowType(this.workflowId), {
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
          ...(hasFinishCallbacks && { recordStepMeta: true }),
          validateInputs: this.validateInputs,
        },
      ],
    });

    // Best-effort, as with core startAsync(): the callbacks are lost if this process exits
    // before the workflow finishes (#24587).
    if (hasFinishCallbacks) {
      void this.#settle(handle, input, initialState).then(result =>
        this.#invokeFinishCallbacks(result, input, requestContext),
      );
    }

    return { runId: this.runId };
  }
}
