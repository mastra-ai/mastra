import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { RequestContext } from '@mastra/core/di';
import { getErrorFromUnknown } from '@mastra/core/error';
import type { ObservabilityContext, TracingOptions } from '@mastra/core/observability';
import { MASTRA_AUTH_TOKEN_KEY } from '@mastra/core/request-context';
import { createTimeTravelExecutionParams, getStepIds, Run } from '@mastra/core/workflows';
import type {
  Step,
  TimeTravelContext,
  WorkflowResult,
  WorkflowRunStartOptions,
  WorkflowRunState,
} from '@mastra/core/workflows';
import {
  ApplicationFailure,
  CancelledFailure,
  WorkflowExecutionAlreadyStartedError,
  WorkflowFailedError,
} from '@temporalio/client';
import type { Client, WorkflowHandle, WorkflowOptions } from '@temporalio/client';
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

  private workflowStartOptions(
    args: Record<string, unknown>,
    options: Pick<WorkflowOptions, 'workflowIdReusePolicy' | 'workflowIdConflictPolicy'> = {},
  ) {
    return {
      taskQueue: this.taskQueue,
      workflowId: this.runId,
      args: [args],
      ...options,
    };
  }

  private startWorkflow(
    args: Record<string, unknown>,
    options: Pick<WorkflowOptions, 'workflowIdReusePolicy' | 'workflowIdConflictPolicy'> = {},
  ) {
    return this.client.workflow.start(toWorkflowType(this.workflowId), this.workflowStartOptions(args, options));
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
    return this.startWorkflow({
      inputData: input,
      initialState,
      requestContext: Object.fromEntries(requestContext.entries()),
      runId: this.runId,
      resourceId: this.resourceId,
      outputOptions: args.outputOptions,
      tracingOptions: args.tracingOptions,
      perStep: args.perStep,
      validateInputs: this.validateInputs,
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

  private resolveSuspendedStep(
    status: unknown,
    payload: { step?: string; label?: string },
  ): { stepId: string; suspendedAt?: number } {
    if (!isSuspendedWorkflowResult(status)) {
      throw new Error(`Workflow run "${this.runId}" is not suspended.`);
    }

    const stepId =
      payload.step ??
      (payload.label ? status.resumeLabels?.[payload.label]?.stepId : undefined) ??
      (status.suspended?.length === 1 && status.suspended[0]?.length === 1 ? status.suspended[0][0] : undefined);
    const stepResult = stepId ? status.steps[stepId] : undefined;
    if (!stepId || !isSuspendedStepResult(stepResult)) {
      throw new Error(`No suspended step matches the requested resume target for run "${this.runId}".`);
    }

    return { stepId, suspendedAt: stepResult.suspendedAt };
  }

  private async claimExecution(handle: WorkflowHandle, operation: 'resume' | 'timeTravel', target?: { step: string }) {
    const token = randomUUID();
    await handle.signal('mastra.claimExecution', {
      action: 'claim',
      operation,
      token,
      ...(target !== undefined && { target }),
    });
    const claim = (await handle.query('mastra.executionClaim')) as
      | { operation?: string; token?: string; stepId?: string }
      | undefined;
    if (claim?.operation !== operation || claim.token !== token) {
      throw new Error(`Temporal ${operation} for run "${this.runId}" was already claimed.`);
    }
    return token;
  }

  private async releaseExecutionClaim(handle: WorkflowHandle, operation: 'resume' | 'timeTravel', token: string) {
    await handle.signal('mastra.claimExecution', { action: 'release', operation, token });
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
    const previousSuspension = this.resolveSuspendedStep(status, payload);
    const claimToken = await this.claimExecution(handle, 'resume', { step: previousSuspension.stepId });
    try {
      await handle.signal('mastra.resume', { ...payload, step: previousSuspension.stepId, claimToken });
    } catch (error) {
      await this.releaseExecutionClaim(handle, 'resume', claimToken).catch(() => undefined);
      throw error;
    }
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
    const payload = await this.resumePayload(params);
    const status = await this.queryStatus(handle);
    const suspension = this.resolveSuspendedStep(status, payload);
    const claimToken = await this.claimExecution(handle, 'resume', { step: suspension.stepId });
    try {
      await handle.signal('mastra.resume', { ...payload, step: suspension.stepId, claimToken });
    } catch (error) {
      await this.releaseExecutionClaim(handle, 'resume', claimToken).catch(() => undefined);
      throw error;
    }
    return { runId: this.runId };
  }

  override restart(
    ..._args: Parameters<Run<TemporalEngineType, TSteps, TState, TInput, TOutput, TRequestContext>['restart']>
  ): never {
    return this.unsupported('restart');
  }

  override async timeTravel<TTimeTravelInput>(
    args: {
      inputData?: TTimeTravelInput;
      resumeData?: any;
      initialState?: TState;
      step:
        | Step<string, any, TTimeTravelInput, any, any, any, TemporalEngineType, any>
        | [
            ...Step<string, any, any, any, any, any, TemporalEngineType, any>[],
            Step<string, any, TTimeTravelInput, any, any, any, TemporalEngineType, any>,
          ]
        | string
        | string[];
      context?: TimeTravelContext<any, any, any, any>;
      nestedStepsContext?: Record<string, TimeTravelContext<any, any, any, any>>;
      requestContext?: RequestContext<TRequestContext>;
      outputWriter?: unknown;
      tracingOptions?: TracingOptions;
      outputOptions?: { includeState?: boolean; includeResumeLabels?: boolean };
      perStep?: boolean;
      actor?: unknown;
    } & Partial<ObservabilityContext>,
  ): Promise<WorkflowResult<TState, TTimeTravelInput, TOutput, TSteps>> {
    const stepParam = args.step;
    if (!stepParam || (Array.isArray(stepParam) && stepParam.length === 0)) {
      throw new Error('Step is required and must be a valid step or array of steps');
    }
    const newStepParam = typeof stepParam === 'string' ? stepParam.split('.') : stepParam;
    const steps = (Array.isArray(newStepParam) ? newStepParam : [newStepParam]).map(step =>
      typeof step === 'string' ? step : step.id,
    );
    if (steps.length !== 1) {
      throw new Error('Temporal time travel currently supports only top-level sequential step targets.');
    }

    const sourceHandle = this.client.workflow.getHandle(this.runId);
    let sourceStatus: unknown;
    try {
      sourceStatus = await sourceHandle.query('mastra.status');
    } catch (error) {
      throw new TemporalWorkflowStatusUnknownError(this.runId, error);
    }
    if (!sourceStatus || typeof sourceStatus !== 'object') {
      throw new Error(`Temporal workflow status for run "${this.runId}" is invalid.`);
    }
    const status = sourceStatus as Record<string, any>;
    if (status.status === 'running') {
      throw new Error('This workflow run is still running, cannot time travel');
    }

    const inputData = args.inputData;
    const snapshot: WorkflowRunState = {
      runId: this.runId,
      status: status.status,
      result: status.result,
      error: status.error,
      requestContext: status.requestContext ?? {},
      value: status.state ?? {},
      context: { input: status.input, ...(status.steps ?? {}) },
      serializedStepGraph: this.serializedStepGraph,
      activePaths: [],
      activeStepsPath: {},
      suspendedPaths: Object.fromEntries(
        ((status.suspended as string[][] | undefined) ?? []).map(path => [path.at(-1)!, []]),
      ),
      resumeLabels: status.resumeLabels ?? {},
      waitingPaths: {},
      timestamp: Date.now(),
    };
    const timeTravel = createTimeTravelExecutionParams({
      steps,
      inputData,
      resumeData: args.resumeData,
      context: args.context,
      nestedStepsContext: args.nestedStepsContext,
      snapshot,
      initialState: args.initialState,
      graph: this.executionGraph,
      perStep: args.perStep,
    });
    const [targetIndex, ...innerPath] = timeTravel.executionPath;
    const targetEntry = this.executionGraph.steps[targetIndex!];
    if (
      !Number.isInteger(targetIndex) ||
      innerPath.length > 0 ||
      targetEntry?.type !== 'step' ||
      targetEntry.step.id !== steps[0]
    ) {
      throw new Error('Temporal time travel currently supports only top-level sequential step targets.');
    }
    for (const entry of this.executionGraph.steps.slice(0, targetIndex)) {
      const stepIds = getStepIds(entry);
      const allowsMissingResults =
        entry.type === 'sleep' ||
        entry.type === 'sleepUntil' ||
        entry.type === 'foreach' ||
        entry.type === 'loop' ||
        entry.type === 'conditional';
      for (const stepId of stepIds) {
        const sourceStepResult = status.steps?.[stepId];
        if (!sourceStepResult) {
          if (allowsMissingResults) continue;
          throw new Error(
            `Cannot time travel to step "${steps[0]}" because preceding step "${stepId}" is missing from the source execution.`,
          );
        }
        if (entry.type === 'conditional' && sourceStepResult.status === 'skipped') continue;
        if (sourceStepResult.status !== 'success') {
          throw new Error(
            `Cannot time travel to step "${steps[0]}" because preceding step "${stepId}" did not succeed in the source execution.`,
          );
        }
        timeTravel.stepResults[stepId] ??= sourceStepResult;
      }
    }
    const storedRequestContext = { ...(status.requestContext ?? {}) };
    delete storedRequestContext[MASTRA_AUTH_TOKEN_KEY];
    const requestContext = new RequestContext<TRequestContext>();
    const mutableRequestContext = requestContext as RequestContext<any>;
    for (const [key, value] of Object.entries(storedRequestContext)) {
      mutableRequestContext.set(key, value);
    }
    for (const [key, value] of args.requestContext?.entries() ?? []) {
      mutableRequestContext.set(key, value);
    }
    await this._validateRequestContext(requestContext as RequestContext<unknown>);

    const claimToken =
      status.status === 'suspended' ? await this.claimExecution(sourceHandle, 'timeTravel') : undefined;

    try {
      const previousTemporalRunId = (await sourceHandle.describe()).runId;
      const workflowArgs = {
        inputData: status.input,
        initialState: timeTravel.state,
        requestContext: Object.fromEntries(requestContext.entries()),
        runId: this.runId,
        resourceId: this.resourceId,
        outputOptions: args.outputOptions,
        tracingOptions: args.tracingOptions,
        perStep: args.perStep,
        validateInputs: this.validateInputs,
        timeTravel,
        timeTravelLineage: { previousTemporalRunId, target: steps },
      };
      let handle: WorkflowHandle;
      if (claimToken) {
        try {
          handle = await this.startWorkflow(workflowArgs, {
            workflowIdReusePolicy: 'ALLOW_DUPLICATE',
            workflowIdConflictPolicy: 'TERMINATE_EXISTING',
          });
        } catch (error) {
          if (
            !(error instanceof WorkflowExecutionAlreadyStartedError) &&
            (!(error instanceof Error) || error.name !== 'WorkflowExecutionAlreadyStartedError')
          ) {
            throw error;
          }
          handle = await this.startWorkflow(workflowArgs, { workflowIdReusePolicy: 'TERMINATE_IF_RUNNING' });
        }
      } else {
        const replacementClaimToken = randomUUID();
        handle = await this.client.workflow.signalWithStart(toWorkflowType(this.workflowId), {
          ...this.workflowStartOptions(workflowArgs, { workflowIdReusePolicy: 'ALLOW_DUPLICATE' }),
          workflowIdConflictPolicy: 'USE_EXISTING',
          signal: 'mastra.claimExecution',
          signalArgs: [{ action: 'claim', operation: 'timeTravel', token: replacementClaimToken }],
        });
        const claim = (await handle.query('mastra.executionClaim')) as
          | { operation?: string; token?: string }
          | undefined;
        if (claim?.operation !== 'timeTravel' || claim.token !== replacementClaimToken) {
          throw new Error(`Temporal time travel for run "${this.runId}" was already claimed.`);
        }
      }

      return this.awaitResultOrSuspended(
        handle,
        status.input as TInput,
        timeTravel.state as TState,
        requestContext as RequestContext,
      ) as unknown as Promise<WorkflowResult<TState, TTimeTravelInput, TOutput, TSteps>>;
    } catch (error) {
      if (claimToken) {
        await this.releaseExecutionClaim(sourceHandle, 'timeTravel', claimToken).catch(() => undefined);
      }
      throw error;
    }
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
