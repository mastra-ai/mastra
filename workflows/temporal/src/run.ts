import { setTimeout as delay } from 'node:timers/promises';
import type { RequestContext } from '@mastra/core/di';
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

      return await this.awaitResultOrSuspended(handle, input, initialState);
    } catch (error) {
      return this.failedResult(input, initialState, error);
    }
  }

  private async awaitResultOrSuspended(handle: WorkflowHandle, input: unknown, initialState: unknown) {
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

      const status =
        typeof handle.query === 'function' ? await handle.query('mastra.status').catch(() => undefined) : undefined;
      if (isSuspendedWorkflowResult(status)) {
        return this.resolveResult(status, input, initialState);
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
    const handle = this.client.workflow.getHandle(this.runId);
    const payload = await this.resumePayload(params);
    await handle.signal('mastra.resume', payload);
    const output = await handle.result();
    return this.resolveResult(output, undefined, undefined);
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

function isWorkflowResult(value: unknown): value is { status: string; steps: unknown } {
  return typeof value === 'object' && value !== null && typeof (value as { status?: unknown }).status === 'string';
}

function isSuspendedWorkflowResult(value: unknown): value is { status: 'suspended'; steps: unknown } {
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
