import { RequestContext } from '@mastra/core/request-context';
import { Run, hydrateSerializedStepErrors } from '@mastra/core/workflows';
import type { DefaultEngineType, Step, WorkflowResult } from '@mastra/core/workflows';
import { encodeRequestContext } from './context.js';
import { unsupported } from './errors.js';
import { json, PROTOCOL_VERSION } from './protocol.js';
import type { WorkflowBinding } from './provider.js';

export class RenderRun<
  TSteps extends Step[] = Step[],
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TContext = unknown,
> extends Run<DefaultEngineType, TSteps, TState, TInput, TOutput, TContext> {
  constructor(
    params: ConstructorParameters<typeof Run<DefaultEngineType, TSteps, TState, TInput, TOutput, TContext>>[0],
    readonly binding: WorkflowBinding,
  ) {
    super(params);
  }

  override async startAsync(
    args: Parameters<Run<DefaultEngineType, TSteps, TState, TInput, TOutput, TContext>['startAsync']>[0],
  ) {
    try {
      return await this.submit(args);
    } finally {
      this.cleanup?.();
    }
  }

  private async submit(
    args: Parameters<Run<DefaultEngineType, TSteps, TState, TInput, TOutput, TContext>['startAsync']>[0],
  ) {
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && !['inputData', 'initialState', 'requestContext'].includes(key))
        unsupported(`start option ${key}`);
    }
    const input = json(await this._validateInput(args.inputData), 'workflow input');
    const state = json(await this._validateInitialState(args.initialState ?? ({} as TState)), 'workflow state');
    const requestContext = encodeRequestContext(
      args.requestContext ?? new RequestContext(),
      this.binding.provider.contextKeys,
    );
    await this._validateRequestContext(new RequestContext<unknown>(Object.entries(requestContext)));
    await this.binding.provider.submit(this.binding, {
      version: PROTOCOL_VERSION,
      workflowId: this.workflowId,
      runId: this.runId,
      ...(this.resourceId === undefined ? {} : { resourceId: this.resourceId }),
      buildId: this.binding.provider.options.buildId,
      manifest: this.binding.manifest().hash,
      input,
      state,
      requestContext,
    });
    return { runId: this.runId };
  }

  override async start(
    args: Parameters<Run<DefaultEngineType, TSteps, TState, TInput, TOutput, TContext>['start']>[0],
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    await this.startAsync(args);
    const record = await this.binding.provider.wait(this.workflowId, this.runId);
    this.workflowRunStatus =
      record.status === 'success' ? 'success' : record.status === 'canceled' ? 'canceled' : 'failed';
    if (
      record.result &&
      typeof record.result === 'object' &&
      !Array.isArray(record.result) &&
      record.result.status === record.status
    ) {
      const result: Record<string, unknown> = structuredClone(record.result);
      result.steps = hydrateSerializedStepErrors(result.steps as Parameters<typeof hydrateSerializedStepErrors>[0]);
      if (result.status === 'failed') result.error = new Error(record.error?.message ?? 'Render workflow failed');
      // Result belongs to this workflow's validated manifest and schemas.
      return result as unknown as WorkflowResult<TState, TInput, TOutput, TSteps>;
    }
    const error = new Error(record.error?.message ?? `Render run ${record.status}`);
    error.name = record.status === 'canceled' ? 'AbortError' : (record.error?.name ?? 'Error');
    return {
      status: 'failed',
      input: args.inputData as TInput,
      steps: {},
      error,
    } as WorkflowResult<TState, TInput, TOutput, TSteps>;
  }

  /** Worker-only entry: executes the existing Mastra engine without submitting a second root. */
  executeLocal(args: Parameters<Run<DefaultEngineType, TSteps, TState, TInput, TOutput, TContext>['start']>[0]) {
    return super.start(args);
  }
  override cancel() {
    return this.binding.provider.cancel(this.workflowId, this.runId);
  }
  override stream(): never {
    return unsupported('workflow streaming');
  }
  override streamLegacy(): never {
    return unsupported('legacy workflow streaming');
  }
  override observeStream(): never {
    return unsupported('observing a workflow stream');
  }
  override observeStreamLegacy(): never {
    return unsupported('observing a legacy workflow stream');
  }
  override resume(): never {
    return unsupported('resume');
  }
  override resumeAsync(): never {
    return unsupported('asynchronous resume');
  }
  override resumeStream(): never {
    return unsupported('resume streaming');
  }
  override restart(): never {
    return unsupported('restart');
  }
  override timeTravel(): never {
    return unsupported('time travel');
  }
  override timeTravelStream(): never {
    return unsupported('time travel streaming');
  }
  override watch(): never {
    return unsupported('cross-process workflow event watchers');
  }
  override watchAsync(): never {
    return unsupported('cross-process workflow event watchers');
  }
}
