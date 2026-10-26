import { setTimeout as delay } from 'node:timers/promises';
import { RequestContext } from '@mastra/core/di';
import type { ObservabilityContext, TracingOptions } from '@mastra/core/observability';
import { createTimeTravelExecutionParams, Run } from '@mastra/core/workflows';
import type {
  Step,
  TimeTravelContext,
  WorkflowResult,
  WorkflowRunStartOptions,
  WorkflowRunState,
} from '@mastra/core/workflows';
import type { Client, WorkflowHandle, WorkflowOptions } from '@temporalio/client';
import type { TemporalEngineType } from './types';
import { toWorkflowType } from './utils';

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

  private startWorkflow(
    args: Record<string, unknown>,
    options: Pick<WorkflowOptions, 'workflowIdReusePolicy' | 'workflowIdConflictPolicy'> = {},
  ) {
    return this.client.workflow.start(toWorkflowType(this.workflowId), {
      taskQueue: this.taskQueue,
      workflowId: this.runId,
      args: [args],
      ...options,
    });
  }

  async start(args: TemporalRunStartArgs<TState, TInput, TRequestContext> = {}) {
    const input = await this._validateInput(args.inputData);
    const initialState = await this._validateInitialState(args.initialState);
    await this._validateRequestContext(args.requestContext as RequestContext<unknown> | undefined);

    try {
      const handle = await this.startWorkflow({
        inputData: input,
        initialState,
        requestContext: args.requestContext ? Object.fromEntries(args.requestContext.entries()) : {},
        runId: this.runId,
        resourceId: this.resourceId,
        outputOptions: args.outputOptions,
        tracingOptions: args.tracingOptions,
        perStep: args.perStep,
      });

      return await this.awaitResultOrSuspended(handle, input, initialState);
    } catch (error) {
      if (error instanceof TemporalWorkflowStatusUnknownError) {
        throw error;
      }
      return this.failedResult(input, initialState, error);
    }
  }

  private async awaitResultOrSuspended(
    handle: WorkflowHandle,
    input: unknown,
    initialState: unknown,
    previousSuspension?: { stepId: string; suspendedAt?: number },
    afterResumeSignal = false,
  ) {
    const terminalResult = handle.result().then(
      output => ({ type: 'terminal' as const, output }),
      error => ({ type: 'failed' as const, error }),
    );

    while (true) {
      const result = await Promise.race([terminalResult, delay(100).then(() => ({ type: 'poll' as const }))]);
      if (result.type === 'terminal') {
        return this.resolveResult(result.output, input, initialState);
      }
      if (result.type === 'failed') {
        return this.failedResult(input, initialState, result.error);
      }

      if (typeof handle.query !== 'function') {
        continue;
      }

      let status: unknown;
      try {
        status = await handle.query('mastra.status');
      } catch (error) {
        throw new TemporalWorkflowStatusUnknownError(this.runId, error, afterResumeSignal);
      }
      if (isSuspendedWorkflowResult(status)) {
        const targetResult = previousSuspension ? status.steps[previousSuspension.stepId] : undefined;
        const isPreviousSuspension =
          previousSuspension !== undefined &&
          targetResult?.status === 'suspended' &&
          targetResult.suspendedAt === previousSuspension.suspendedAt;
        if (!isPreviousSuspension) {
          return this.resolveResult(status, input, initialState);
        }
      }
    }
  }

  private resolveResult(output: unknown, input: unknown, initialState: unknown) {
    if (isWorkflowResult(output)) {
      return {
        ...output,
        ...(input !== undefined && { input: input as TInput }),
        steps: normalizeStepResults(output.steps),
      } as WorkflowResult<TState, TInput, TOutput, TSteps>;
    }

    return {
      status: 'success',
      input: input as TInput,
      result: output as TOutput,
      state: initialState,
      steps: {},
    } as WorkflowResult<TState, TInput, TOutput, TSteps>;
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

  private async resumePayload(
    params: {
      step?:
        | Step<string, any, any, any, any, any, TemporalEngineType, any>
        | Step<string, any, any, any, any, any, TemporalEngineType, any>[]
        | string
        | string[];
      label?: string;
      resumeData?: unknown;
    },
    handle: WorkflowHandle,
  ) {
    const step = Array.isArray(params.step) ? params.step.at(-1) : params.step;
    let stepId = typeof step === 'string' ? step : step?.id;
    let status: unknown;
    if (typeof handle.query === 'function') {
      try {
        status = await handle.query('mastra.status');
      } catch (error) {
        throw new TemporalWorkflowStatusUnknownError(this.runId, error);
      }
    }

    if (isSuspendedWorkflowResult(status)) {
      if (stepId === undefined && params.label !== undefined) {
        stepId = status.resumeLabels?.[params.label]?.stepId;
        if (stepId === undefined) {
          throw new Error(`Temporal workflow has no active suspension with label "${params.label}".`);
        }
      }

      if (stepId === undefined) {
        const suspended = status.suspended ?? [];
        if (suspended.length !== 1 || suspended[0]?.length !== 1) {
          throw new Error('Temporal resume requires a step or label when multiple steps are suspended.');
        }
        stepId = suspended[0][0];
      }

      if (!(status.suspended ?? []).some(path => path.at(-1) === stepId)) {
        throw new Error(`Temporal workflow is not suspended at step "${stepId}".`);
      }
    } else if (status !== undefined || stepId === undefined) {
      throw new Error('Temporal resume requires an active suspended step or label.');
    }

    const targetStepId = stepId;
    if (targetStepId === undefined) {
      throw new Error('Temporal resume requires an active suspended step or label.');
    }
    const resumeData = await this._validateResumeData(params.resumeData, this.workflowSteps[targetStepId]);

    return {
      payload: {
        step: targetStepId,
        ...(params.label !== undefined && { label: params.label }),
        resumeData,
      },
      previousSuspension: {
        stepId: targetStepId,
        suspendedAt: isSuspendedWorkflowResult(status) ? status.steps[targetStepId]?.suspendedAt : undefined,
      },
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
    const handle = this.client.workflow.getHandle(this.runId);
    const { payload, previousSuspension } = await this.resumePayload(params, handle);
    await handle.signal('mastra.resume', payload);
    return this.awaitResultOrSuspended(handle, undefined, undefined, previousSuspension, true);
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
    await this._validateRequestContext(params.requestContext as RequestContext<unknown> | undefined);
    const handle = this.client.workflow.getHandle(this.runId);
    const { payload } = await this.resumePayload(params, handle);
    await handle.signal('mastra.resume', payload);
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

    const newStepParam = typeof stepParam === 'string' ? stepParam.split('.') : stepParam;
    const steps = (Array.isArray(newStepParam) ? newStepParam : [newStepParam]).map(step =>
      typeof step === 'string' ? step : step.id,
    );
    const inputData = args.inputData;
    const snapshot: WorkflowRunState = {
      runId: this.runId,
      status: status.status,
      result: status.result,
      error: status.error,
      requestContext: {},
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
      if (entry.type !== 'step') continue;
      const sourceStepResult = status.steps?.[entry.step.id];
      if (!sourceStepResult) {
        throw new Error(
          `Cannot time travel to step "${steps[0]}" because preceding step "${entry.step.id}" is missing from the source execution.`,
        );
      }
      timeTravel.stepResults[entry.step.id] = sourceStepResult;
    }
    const previousTemporalRunId = (await sourceHandle.describe()).runId;
    const requestContext = args.requestContext ?? new RequestContext<TRequestContext>();
    await this._validateRequestContext(requestContext as RequestContext<unknown>);

    const handle = await this.startWorkflow(
      {
        inputData: timeTravel.inputData,
        initialState: timeTravel.state,
        requestContext: Object.fromEntries(requestContext.entries()),
        runId: this.runId,
        resourceId: this.resourceId,
        outputOptions: args.outputOptions,
        tracingOptions: args.tracingOptions,
        perStep: args.perStep,
        timeTravel,
        timeTravelLineage: { previousTemporalRunId, target: steps },
      },
      status.status === 'suspended'
        ? { workflowIdReusePolicy: 'TERMINATE_IF_RUNNING' }
        : { workflowIdReusePolicy: 'ALLOW_DUPLICATE' },
    );

    return this.awaitResultOrSuspended(
      handle,
      timeTravel.inputData as TInput,
      timeTravel.state as TState,
    ) as unknown as Promise<WorkflowResult<TState, TTimeTravelInput, TOutput, TSteps>>;
  }

  override timeTravelStream(..._args: unknown[]): never {
    return this.unsupported('timeTravelStream');
  }

  async startAsync(args: TemporalRunStartArgs<TState, TInput, TRequestContext> = {}) {
    const input = await this._validateInput(args.inputData);
    const initialState = await this._validateInitialState(args.initialState);
    await this._validateRequestContext(args.requestContext as RequestContext<unknown> | undefined);

    await this.startWorkflow({
      inputData: input,
      initialState,
      requestContext: args.requestContext ? Object.fromEntries(args.requestContext.entries()) : {},
      runId: this.runId,
      resourceId: this.resourceId,
      outputOptions: args.outputOptions,
      tracingOptions: args.tracingOptions,
      perStep: args.perStep,
    });

    return { runId: this.runId };
  }
}

function isWorkflowResult(value: unknown): value is { status: string; steps: unknown } {
  return typeof value === 'object' && value !== null && typeof (value as { status?: unknown }).status === 'string';
}

function isSuspendedWorkflowResult(value: unknown): value is {
  status: 'suspended';
  steps: Record<string, { status?: unknown; suspendedAt?: number }>;
  suspended?: string[][];
  resumeLabels?: Record<string, { stepId?: string }>;
} {
  return typeof value === 'object' && value !== null && (value as { status?: unknown }).status === 'suspended';
}

// The worker only records successful steps; a failed run rejects handle.result() instead.
function normalizeStepResult(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    return { status: 'success', output: value, startedAt: 0, endedAt: 0 };
  }

  const record = value as Record<string, unknown>;
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

// Workers built before step results used the core StepResult shape return raw step outputs.
function normalizeStepResults<T>(steps: T): T {
  if (!steps || typeof steps !== 'object') {
    return {} as T;
  }
  return Object.fromEntries(Object.entries(steps).map(([id, value]) => [id, normalizeStepResult(value)])) as T;
}
