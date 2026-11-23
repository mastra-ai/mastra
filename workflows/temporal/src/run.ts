import { setTimeout as delay } from 'node:timers/promises';
import { RequestContext } from '@mastra/core/di';
import { getErrorFromUnknown } from '@mastra/core/error';
import { Run } from '@mastra/core/workflows';
import type { Step, WorkflowResult, WorkflowRunStartOptions } from '@mastra/core/workflows';
import {
  ApplicationFailure,
  CancelledFailure,
  WorkflowExecutionAlreadyStartedError,
  WorkflowFailedError,
} from '@temporalio/client';
import type { Client, WorkflowHandle } from '@temporalio/client';
import type { WorkflowFailureDetails } from './transforms/temporal-workflow-runtime';
import type { TemporalEngineType } from './types';
import { toWorkflowType } from './utils';

// Runs failed by a Worker that predates these details return undefined.
function toFailureDetails(error: unknown): WorkflowFailureDetails | undefined {
  if (!(error instanceof WorkflowFailedError) || !(error.cause instanceof ApplicationFailure)) {
    return undefined;
  }

  const details = error.cause.details?.[0] as Partial<WorkflowFailureDetails> | undefined;
  return details?.error && details.steps ? (details as WorkflowFailureDetails) : undefined;
}

function toError(error: WorkflowFailureDetails['error']): Error {
  return getErrorFromUnknown(error, { serializeStack: false });
}

type TemporalRunStartArgs<TState, TInput, TRequestContext> = {
  inputData?: TInput;
  initialState?: TState;
  requestContext?: RequestContext<TRequestContext>;
} & WorkflowRunStartOptions;

export class TemporalWorkflowStatusUnknownError extends Error {
  constructor(runId: string, cause: unknown, afterResumeSignal = false) {
    super(
      afterResumeSignal
        ? `Unable to determine Temporal workflow status for run "${runId}" after sending a resume signal. The signal may have been delivered; do not retry resume() blindly.`
        : `Unable to determine Temporal workflow status for run "${runId}".`,
      { cause },
    );
    this.name = 'TemporalWorkflowStatusUnknownError';
  }
}

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
      if (!(error instanceof WorkflowExecutionAlreadyStartedError)) {
        await this.invokeLifecycleCallbacks(result, requestContext);
      }
      return result;
    }

    return this.awaitResultOrSuspended(handle, input, initialState, requestContext);
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
          validateInputs: this.validateInputs,
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
    const result = await this.resolveResult(handle, input, initialState);
    await this.invokeLifecycleCallbacks(result, requestContext);
    return result;
  }

  private async queryStatus(handle: WorkflowHandle, afterResumeSignal = false): Promise<unknown> {
    if (typeof handle.query !== 'function') {
      return undefined;
    }

    try {
      return await handle.query('mastra.status');
    } catch (error) {
      throw new TemporalWorkflowStatusUnknownError(this.runId, error, afterResumeSignal);
    }
  }

  private async awaitResultOrSuspended(
    handle: WorkflowHandle,
    input: unknown,
    initialState: unknown,
    requestContext: RequestContext,
    previousSuspension?: { stepId: string; suspendedAt?: number },
    afterResumeSignal = false,
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const terminal = this.resolveResult(handle, input, initialState);

    while (true) {
      const result = await Promise.race([
        terminal.then(result => ({ type: 'terminal' as const, result })),
        delay(100).then(() => ({ type: 'poll' as const })),
      ]);

      if (result.type === 'terminal') {
        await this.invokeLifecycleCallbacks(result.result, requestContext);
        return result.result;
      }

      const status = await this.queryStatus(handle, afterResumeSignal);
      if (isSuspendedWorkflowResult(status)) {
        const previousStep = previousSuspension ? status.steps[previousSuspension.stepId] : undefined;
        const isPreviousSuspension =
          previousSuspension !== undefined &&
          isSuspendedStepResult(previousStep) &&
          previousStep.suspendedAt === previousSuspension.suspendedAt;
        if (isPreviousSuspension) {
          continue;
        }

        const suspended = {
          ...status,
          steps: toStepResults(status.input, status.steps),
        } as WorkflowResult<TState, TInput, TOutput, TSteps>;
        await this.invokeLifecycleCallbacks(suspended, requestContext);
        return suspended;
      }
    }
  }

  private async resolveResult(handle: WorkflowHandle, input: unknown, initialState: unknown) {
    try {
      // The generated Temporal workflow returns the execution result ({ status, result, state, steps }).
      const output = (await handle.result()) as WorkflowResult<TState, TInput, TOutput, TSteps>;
      return {
        ...output,
        ...(input !== undefined && { input: input as TInput }),
        steps: toStepResults(input !== undefined ? input : output.input, output.steps),
      } as WorkflowResult<TState, TInput, TOutput, TSteps>;
    } catch (error) {
      if (error instanceof WorkflowFailedError && error.cause instanceof CancelledFailure) {
        return {
          status: 'canceled',
          input: input as TInput,
          state: initialState,
          steps: {},
        } as unknown as WorkflowResult<TState, TInput, TOutput, TSteps>;
      }

      const failure = toFailureDetails(error);

      if (failure) {
        const steps = toStepResults(input, failure.steps);
        return (
          failure.tripwire
            ? { status: 'tripwire', input, tripwire: failure.tripwire, state: initialState, steps }
            : { status: 'failed', input, error: toError(failure.error), state: initialState, steps }
        ) as WorkflowResult<TState, TInput, TOutput, TSteps>;
      }

      return this.failedResult(input, initialState, error);
    }
  }

  private failedResult(input: unknown, initialState: unknown, error: unknown) {
    return {
      status: 'failed',
      input: input as TInput,
      error: error instanceof Error ? error : new Error(String(error)),
      state: initialState,
      steps: toStepResults(input, {}),
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
      tripwire: result.status === 'tripwire' ? result.tripwire : undefined,
      steps: result.steps,
      runId: this.runId,
      workflowId: this.workflowId,
      resourceId: this.resourceId,
      input: result.input,
      requestContext,
      state: (result.state ?? {}) as Record<string, any>,
    });
  }

  private async resumePayload(params: {
    step?:
      | Step<string, any, any, any, any, any, TemporalEngineType, any>
      | Step<string, any, any, any, any, any, TemporalEngineType, any>[]
      | string
      | string[];
    label?: string;
    resumeData?: unknown;
  }) {
    const step = Array.isArray(params.step) ? params.step.at(-1) : params.step;
    const stepId = typeof step === 'string' ? step : step?.id;
    const resumeData = await this._validateResumeData(
      params.resumeData,
      stepId ? this.workflowSteps[stepId] : undefined,
    );

    return {
      ...(stepId !== undefined && { step: stepId }),
      ...(params.label !== undefined && { label: params.label }),
      resumeData,
    };
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

  override async resume<TResume>(params: {
    resumeData?: TResume;
    step?:
      | Step<string, any, any, any, TResume, any, TemporalEngineType, any>
      | [
          ...Step<string, any, any, any, any, any, TemporalEngineType, any>[],
          Step<string, any, any, any, TResume, any, TemporalEngineType, any>,
        ]
      | string
      | string[];
    label?: string;
    requestContext?: RequestContext<TRequestContext>;
    retryCount?: number;
    tracingOptions?: any;
    outputWriter?: any;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    forEachIndex?: number;
    perStep?: boolean;
    actor?: any;
  }) {
    await this._validateRequestContext(params.requestContext as RequestContext<unknown> | undefined);
    const requestContext = (params.requestContext ?? new RequestContext()) as RequestContext;
    const handle = this.client.workflow.getHandle(this.runId);
    const payload = await this.resumePayload(params);
    const status = await this.queryStatus(handle);
    const stepId = isSuspendedWorkflowResult(status)
      ? (payload.step ??
        (payload.label ? status.resumeLabels?.[payload.label]?.stepId : undefined) ??
        (status.suspended?.length === 1 && status.suspended[0]?.length === 1 ? status.suspended[0][0] : undefined))
      : undefined;
    const previousStep = stepId && isSuspendedWorkflowResult(status) ? status.steps[stepId] : undefined;
    const previousSuspension =
      stepId && isSuspendedStepResult(previousStep) ? { stepId, suspendedAt: previousStep.suspendedAt } : undefined;
    await handle.signal('mastra.resume', payload);
    return this.awaitResultOrSuspended(handle, undefined, undefined, requestContext, previousSuspension, true);
  }

  override async resumeAsync<TResume>(params: {
    resumeData?: TResume;
    step?:
      | Step<string, any, any, any, TResume, any, TemporalEngineType, any>
      | [
          ...Step<string, any, any, any, any, any, TemporalEngineType, any>[],
          Step<string, any, any, any, TResume, any, TemporalEngineType, any>,
        ]
      | string
      | string[];
    label?: string;
    requestContext?: RequestContext<TRequestContext>;
    retryCount?: number;
    tracingOptions?: any;
    outputWriter?: any;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
    forEachIndex?: number;
    perStep?: boolean;
    actor?: any;
  }) {
    const handle = this.client.workflow.getHandle(this.runId);
    await handle.signal('mastra.resume', await this.resumePayload(params));
    return { runId: this.runId };
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
      if (!(error instanceof WorkflowExecutionAlreadyStartedError)) {
        await this.invokeLifecycleCallbacks(this.failedResult(input, initialState, error), requestContext);
      }
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

function isSuspendedWorkflowResult(value: unknown): value is {
  status: 'suspended';
  input?: unknown;
  steps: Record<string, unknown>;
  suspended?: string[][];
  resumeLabels?: Record<string, { stepId: string }>;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { status?: unknown }).status === 'suspended' &&
    typeof (value as { steps?: unknown }).steps === 'object' &&
    (value as { steps?: unknown }).steps !== null
  );
}

function isSuspendedStepResult(value: unknown): value is { status: 'suspended'; suspendedAt?: number } {
  return typeof value === 'object' && value !== null && (value as { status?: unknown }).status === 'suspended';
}

// Failed step records arrive in the failure details of a failed run, not in handle.result().
function normalizeStepResult(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    return { status: 'success', output: value, startedAt: 0, endedAt: 0 };
  }

  const record = value as Record<string, unknown>;
  if (record.__temporalStepResult === true && record.status === 'failed') {
    return {
      status: 'failed',
      payload: record.payload,
      error: toError(record.error as WorkflowFailureDetails['error']),
      ...(record.tripwire !== undefined && { tripwire: record.tripwire }),
      startedAt: record.startedAt,
      endedAt: record.endedAt,
    };
  }

  if (record.__temporalStepResult === true && record.status === 'suspended' && typeof record.suspendedAt === 'number') {
    return {
      status: 'suspended',
      payload: record.payload,
      suspendPayload: record.suspendPayload,
      suspendedAt: record.suspendedAt,
    };
  }

  if (
    record.__temporalStepResult === true &&
    record.status === 'success' &&
    typeof record.startedAt === 'number' &&
    typeof record.endedAt === 'number'
  ) {
    return {
      status: 'success',
      payload: record.payload,
      output: record.output,
      ...(record.suspendPayload !== undefined && { suspendPayload: record.suspendPayload }),
      ...(record.resumeData !== undefined && { resumeData: record.resumeData }),
      startedAt: record.startedAt,
      endedAt: record.endedAt,
    };
  }

  return { status: 'success', output: value, startedAt: 0, endedAt: 0 };
}

// Like a local run, the step records start with the workflow input under `input`.
function toStepResults<T>(input: unknown, steps: T): T {
  return { input, ...normalizeStepResults(steps) } as T;
}

// Workers built before step results used the core StepResult shape return raw step outputs.
function normalizeStepResults<T>(steps: T): T {
  if (!steps || typeof steps !== 'object') {
    return {} as T;
  }
  return Object.fromEntries(Object.entries(steps).map(([id, value]) => [id, normalizeStepResult(value)])) as T;
}
