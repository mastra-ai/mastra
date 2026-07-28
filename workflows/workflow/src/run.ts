import type { RequestContext } from '@mastra/core/di';
import { getErrorFromUnknown } from '@mastra/core/error';
import { WorkflowRunOutput, ChunkFrom } from '@mastra/core/stream';
import { Run } from '@mastra/core/workflows';
import type {
  Step,
  WorkflowResult,
  WorkflowRunStartOptions,
  WorkflowRunState,
  WorkflowStreamEvent,
} from '@mastra/core/workflows';
import { getRun, resumeHook, start as startWorkflowSdkRun } from 'workflow/api';
import { MASTRA_EVENT_NAMESPACE } from './constants';
import { readSdkRunId, withSdkRunId } from './snapshot';
import type { WorkflowSdkEngineType, MastraRunnerParams, SerializedOpError, WorkflowSdkRunnerRef } from './types';
import { suspendToken, type WalkerParams } from './workflows/walker';

type WorkflowSdkRunStartArgs<TState, TInput, TRequestContext> = {
  inputData?: TInput;
  initialState?: TState;
  requestContext?: RequestContext<TRequestContext>;
} & WorkflowRunStartOptions;

/** Extra bits `WorkflowSdkWorkflow` hands to each run. */
export interface WorkflowSdkRunOptions {
  /**
   * The `mastraRunner` function this run starts, threaded down from
   * `init({ runner })`.
   *
   * Passed in rather than imported so no host-side module here reaches
   * `workflows/runner`; see {@link WorkflowSdkRunnerRef}. `suspendToken` above
   * comes from `workflows/walker`, which carries no directives and imports only
   * `constants` — importing it is safe, importing the runner is not.
   */
  runner?: WorkflowSdkRunnerRef;
  stepRetries?: Record<string, number>;
}

/** Partially-observed run state, rebuilt from the event stream. */
interface ObservedRun {
  status: 'success' | 'failed' | 'suspended';
  result?: unknown;
  error?: SerializedOpError;
  state: Record<string, unknown>;
  steps: Record<string, unknown>;
  suspendedStepId?: string;
  suspendPayload?: unknown;
}

function unsupported(feature: string): Error {
  return new Error(`${feature} is not yet supported by @mastra/workflow.`);
}

export class WorkflowSdkRun<
  TSteps extends Step<string, any, any, any, any, any, WorkflowSdkEngineType, any>[] = Step<
    string,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    WorkflowSdkEngineType
  >[],
  TState = unknown,
  TInput = unknown,
  TOutput = unknown,
  TRequestContext extends Record<string, any> | unknown = unknown,
> extends Run<WorkflowSdkEngineType, TSteps, TState, TInput, TOutput, TRequestContext> {
  /**
   * Run id assigned by the Workflow SDK, distinct from the Mastra `runId`.
   *
   * `start()` does not accept a caller-supplied id, so the two id spaces stay
   * separate. Mastra's id is what hook tokens are built from and is therefore
   * enough to resume a run from any process; the Workflow SDK id is what reading
   * streams, cancelling, and awaiting an outcome need. It is cached here for the
   * process that started the run and mirrored onto the stored snapshot so a
   * second process can recover it — see {@link WorkflowSdkRun.#resolveSdkRunId}.
   */
  #sdkRunId?: string;
  /**
   * Number of stream chunks already consumed for this run.
   *
   * `getReadable()` replays a run's stream from the beginning by default. After
   * `start()` returns on a suspension, a later `resume()` has to pick up where
   * it left off — otherwise it re-reads the original `workflow-step-suspended`
   * event and reports the run as still suspended.
   */
  #streamCursor = 0;
  readonly #stepRetries: Record<string, number>;
  readonly #runner?: WorkflowSdkRunnerRef;

  constructor(
    params: ConstructorParameters<
      typeof Run<WorkflowSdkEngineType, TSteps, TState, TInput, TOutput, TRequestContext>
    >[0],
    options: WorkflowSdkRunOptions = {},
  ) {
    super(params);
    this.#stepRetries = options.stepRetries ?? {};
    this.#runner = options.runner;
  }

  /** Workflow SDK run id, once the run has been started in this process. */
  get sdkRunId(): string | undefined {
    return this.#sdkRunId;
  }

  async #workflowsStore() {
    return this.mastra?.getStorage()?.getStore('workflows');
  }

  /**
   * Starts the underlying Workflow SDK run and records the id mapping.
   *
   * Shared by `start()`, `startAsync()` and `stream()` so every entry point
   * leaves the same trail for a second process to pick up.
   */
  async #startSdkRun(params: WalkerParams): Promise<string> {
    if (!this.#runner) {
      throw new Error(
        `Cannot start workflow "${this.workflowId}": no Workflow SDK runner was supplied. ` +
          `Build workflows with the \`createWorkflow\` returned by \`init({ runner })\`, passing the ` +
          `\`mastraRunner\` re-exported from your own workflows/ directory.`,
      );
    }
    const sdkRun = await startWorkflowSdkRun(this.#runner, [params], {
      // `$`-prefixed keys are reserved for tooling; these plain keys let the
      // Workflow SDK dashboard show which Mastra run a Workflow SDK run belongs to.
      attributes: { mastraRunId: this.runId, mastraWorkflowId: this.workflowId },
    });
    this.#sdkRunId = sdkRun.runId;
    await this.#persistSdkRunId(sdkRun.runId, params);
    return sdkRun.runId;
  }

  /**
   * Writes the Mastra run → Workflow SDK run mapping to storage.
   *
   * Steps write it too, on every snapshot, but only once the first one has
   * finished. Writing it here as well means a run is resumable, watchable and
   * cancellable from another process from the moment `start()` returns.
   *
   * Best-effort: storage is optional for Workflow SDK-backed runs, and a run
   * that cannot be mirrored still executes normally.
   */
  async #persistSdkRunId(sdkRunId: string, params: WalkerParams): Promise<void> {
    try {
      const store = await this.#workflowsStore();
      if (!store) {
        return;
      }
      const previous = await store
        .loadWorkflowSnapshot({ workflowName: this.workflowId, runId: this.runId })
        .catch(() => null);
      const base: WorkflowRunState = previous ?? {
        runId: this.runId,
        status: 'pending',
        value: (params.initialState ?? {}) as WorkflowRunState['value'],
        context: { input: params.inputData as Record<string, any> } as WorkflowRunState['context'],
        activePaths: [],
        activeStepsPath: {},
        waitingPaths: {},
        suspendedPaths: {},
        resumeLabels: {},
        serializedStepGraph: this.serializedStepGraph,
        timestamp: Date.now(),
      };
      await store.persistWorkflowSnapshot({
        workflowName: this.workflowId,
        runId: this.runId,
        resourceId: this.resourceId,
        snapshot: withSdkRunId(base, sdkRunId),
      });
    } catch {
      // Storage is optional; the in-memory id still serves this process.
    }
  }

  /**
   * Returns the Workflow SDK run id, recovering it from storage when this
   * process is not the one that started the run.
   *
   * On recovery the stream cursor is fast-forwarded past everything already
   * written. A run reached this way is parked on a hook, so its stream ends
   * with the `workflow-step-suspended` event that parked it; replaying from the
   * start would hand the caller back that stale suspension instead of the
   * events their resume is about to produce.
   */
  async #resolveSdkRunId(): Promise<string | undefined> {
    if (this.#sdkRunId) {
      return this.#sdkRunId;
    }
    const store = await this.#workflowsStore();
    const snapshot = await store
      ?.loadWorkflowSnapshot({ workflowName: this.workflowId, runId: this.runId })
      .catch(() => null);
    const sdkRunId = readSdkRunId(snapshot);
    if (!sdkRunId) {
      return undefined;
    }
    this.#sdkRunId = sdkRunId;
    this.#streamCursor = await tailIndexOf(sdkRunId);
    return sdkRunId;
  }

  /** Explains what to configure when a run cannot be located from this process. */
  #unknownSdkRunError(action: string): Error {
    return new Error(
      `Cannot ${action} run ${this.runId} from this process: its Workflow SDK run id is unknown. ` +
        `Resuming, watching and cancelling a run started elsewhere require storage on the Mastra ` +
        `instance (\`new Mastra({ storage })\`), which is where the two run ids are mapped to each ` +
        `other. Without storage, resume a suspended step by calling ` +
        `\`resumeHook("mastra:${this.runId}:<stepId>", data)\` from \`workflow/api\` instead.`,
    );
  }

  #buildRunnerParams(
    inputData: TInput | undefined,
    initialState: TState | undefined,
    requestContext?: RequestContext<TRequestContext>,
  ): WalkerParams {
    return {
      workflowId: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      inputData,
      initialState: (initialState ?? {}) as Record<string, unknown>,
      requestContext: requestContext ? [...requestContext.entries()] : [],
      serializedStepGraph: this.serializedStepGraph as unknown[],
      stepRetries: this.#stepRetries,
      retryConfig: this.retryConfig,
    };
  }

  /**
   * Reads the run's Mastra event stream until the run reaches a state a caller
   * of `start()`/`resume()` should be handed back.
   *
   * That is either `workflow-finish` or the first `workflow-step-suspended`:
   * a suspended run stays alive inside the Workflow SDK waiting on its hook, so
   * waiting for the Workflow SDK run to complete would block until someone resumes
   * it, which is exactly what the caller is being handed control to do.
   */
  async #observeUntilSettled(sdkRunId: string, seedSteps: Record<string, unknown> = {}): Promise<ObservedRun> {
    const readable = getRun(sdkRunId).getReadable<Record<string, any>>({
      namespace: MASTRA_EVENT_NAMESPACE,
      startIndex: this.#streamCursor,
    });
    const reader = readable.getReader();
    const steps: Record<string, unknown> = { ...seedSteps };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          // The stream closed without a finish event, which means the run ended
          // abnormally (cancelled, or the handler crashed hard enough that the
          // walker never got to emit).
          return {
            status: 'failed',
            error: { message: `Workflow run ${this.runId} ended without reporting a result` },
            state: {},
            steps,
          };
        }
        this.#streamCursor += 1;
        if (!value || typeof value.type !== 'string') {
          continue;
        }

        const payload = (value.payload ?? {}) as Record<string, any>;

        if (value.type === 'workflow-step-result' || value.type === 'workflow-step-suspended') {
          if (typeof payload.id === 'string') {
            steps[payload.id] = { ...payload };
          }
        }

        if (value.type === 'workflow-step-suspended') {
          return {
            status: 'suspended',
            state: {},
            steps,
            suspendedStepId: typeof payload.id === 'string' ? payload.id : undefined,
            suspendPayload: payload.suspendPayload,
          };
        }

        if (value.type === 'workflow-finish') {
          return {
            status: payload.status === 'failed' ? 'failed' : 'success',
            result: payload.result,
            error: payload.error,
            state: (payload.state ?? {}) as Record<string, unknown>,
            steps: (payload.steps as Record<string, unknown>) ?? steps,
          };
        }
      }
    } finally {
      reader.releaseLock();
      // Detach from the stream; for a suspended run it stays open indefinitely.
      await readable.cancel().catch(() => {});
    }
  }

  #toWorkflowResult(
    observed: ObservedRun,
    inputData: TInput | undefined,
    includeState: boolean,
  ): WorkflowResult<TState, TInput, TOutput, TSteps> {
    const base = {
      input: inputData as TInput,
      steps: observed.steps as never,
      ...(includeState ? { state: observed.state as TState } : {}),
    };

    if (observed.status === 'suspended') {
      return {
        ...base,
        status: 'suspended',
        suspendPayload: observed.suspendPayload,
        suspended: [[observed.suspendedStepId ?? '']],
      } as WorkflowResult<TState, TInput, TOutput, TSteps>;
    }

    if (observed.status === 'failed') {
      return {
        ...base,
        status: 'failed',
        error: getErrorFromUnknown(observed.error ?? new Error('Workflow failed'), { serializeStack: false }),
      } as WorkflowResult<TState, TInput, TOutput, TSteps>;
    }

    return {
      ...base,
      status: 'success',
      result: observed.result as TOutput,
    } as WorkflowResult<TState, TInput, TOutput, TSteps>;
  }

  async start(
    args: WorkflowSdkRunStartArgs<TState, TInput, TRequestContext> = {},
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const inputData = await this._validateInput(args.inputData);
    const initialState = await this._validateInitialState(args.initialState ?? ({} as TState));

    const params = this.#buildRunnerParams(inputData, initialState, args.requestContext);
    const sdkRunId = await this.#startSdkRun(params);

    const observed = await this.#observeUntilSettled(sdkRunId);
    const result = this.#toWorkflowResult(observed, inputData, Boolean(args.outputOptions?.includeState));

    if (result.status !== 'suspended') {
      this.cleanup?.();
    }
    return result;
  }

  /** Starts the run and returns as soon as it is enqueued. */
  async startAsync(args: WorkflowSdkRunStartArgs<TState, TInput, TRequestContext> = {}): Promise<{ runId: string }> {
    const inputData = await this._validateInput(args.inputData);
    const initialState = await this._validateInitialState(args.initialState ?? ({} as TState));

    const params = this.#buildRunnerParams(inputData, initialState, args.requestContext);
    await this.#startSdkRun(params);

    return { runId: this.runId };
  }

  /**
   * Resumes a suspended step by resolving the hook it parked on.
   *
   * The token is derived from the Mastra run and step ids, so the resume itself
   * works from any process. Awaiting the outcome additionally needs the
   * Workflow SDK run id, which is read back from storage when this process is
   * not the one that started the run.
   */
  async resume<TResume>(params: {
    resumeData?: TResume;
    step?: Step<string, any, any, TResume, any> | Step<string, any, any, any, any>[] | string | string[];
    foreachIndex?: number;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const stepId = resolveStepId(params.step);
    if (!stepId) {
      throw new Error(
        'resume() requires a `step` for Workflow SDK-backed workflows: the hook token that ' +
          'parks a suspended step is derived from its id.',
      );
    }

    const suspendedStep = this.workflowSteps[stepId];
    const resumeData = await this._validateResumeData(params.resumeData, suspendedStep);
    const token = suspendToken(this.runId, stepId, params.foreachIndex);

    // Resolved before the resume so the stream cursor is parked at the tail
    // while the run is still suspended, and no post-resume event is missed.
    const sdkRunId = await this.#resolveSdkRunId();
    if (!sdkRunId) {
      throw this.#unknownSdkRunError('resume');
    }

    await resumeHook(token, resumeData);

    const observed = await this.#observeUntilSettled(sdkRunId);
    return this.#toWorkflowResult(observed, undefined, false);
  }

  /**
   * Delivers the run's Mastra events to `cb` until the returned function is
   * called.
   *
   * Watching a run started in another process works as long as the Mastra
   * instance has storage; locating that run is asynchronous, so the callback
   * starts receiving events shortly after this returns rather than
   * synchronously.
   */
  watch(cb: (event: WorkflowStreamEvent) => void): () => void {
    let active = true;
    let readable: ReadableStream<WorkflowStreamEvent> | undefined;

    void (async () => {
      const sdkRunId = await this.#resolveSdkRunId();
      if (!sdkRunId) {
        // `watch()` is synchronous by contract, so there is no promise to
        // reject onto; the logger is the only channel back to the caller.
        this.mastra?.getLogger()?.error(this.#unknownSdkRunError('watch').message);
        return;
      }
      if (!active) {
        return;
      }

      readable = getRun(sdkRunId).getReadable<WorkflowStreamEvent>({
        namespace: MASTRA_EVENT_NAMESPACE,
      });
      const reader = readable.getReader();
      try {
        while (active) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          if (value) {
            cb(value);
          }
        }
      } catch {
        // Stream ended or was cancelled; nothing left to deliver.
      } finally {
        reader.releaseLock();
      }
    })();

    return () => {
      active = false;
      void readable?.cancel().catch(() => {});
    };
  }

  stream(
    args: WorkflowSdkRunStartArgs<TState, TInput, TRequestContext> = {},
  ): WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    if (this.streamOutput) {
      return this.streamOutput;
    }

    const self = this;
    const stream = new ReadableStream<WorkflowStreamEvent>({
      async start(controller) {
        let closed = false;
        const close = () => {
          if (closed) {
            return;
          }
          closed = true;
          try {
            controller.close();
          } catch {
            // Already closed by a racing path.
          }
        };

        try {
          const inputData = await self._validateInput(args.inputData);
          const initialState = await self._validateInitialState(args.initialState ?? ({} as TState));
          const params = self.#buildRunnerParams(inputData, initialState, args.requestContext);
          const sdkRunId = await self.#startSdkRun(params);

          const readable = getRun(sdkRunId).getReadable<Record<string, any>>({
            namespace: MASTRA_EVENT_NAMESPACE,
            startIndex: self.#streamCursor,
          });
          const reader = readable.getReader();
          const steps: Record<string, unknown> = {};
          let observed: ObservedRun | undefined;

          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              self.#streamCursor += 1;
              if (!value || typeof value.type !== 'string') {
                continue;
              }

              const payload = (value.payload ?? {}) as Record<string, any>;
              controller.enqueue({
                type: value.type,
                runId: self.runId,
                from: ChunkFrom.WORKFLOW,
                payload: { stepName: payload.id, ...payload },
              } as WorkflowStreamEvent);

              if (
                (value.type === 'workflow-step-result' || value.type === 'workflow-step-suspended') &&
                typeof payload.id === 'string'
              ) {
                steps[payload.id] = { ...payload };
              }

              if (value.type === 'workflow-step-suspended') {
                observed = {
                  status: 'suspended',
                  state: {},
                  steps,
                  suspendedStepId: typeof payload.id === 'string' ? payload.id : undefined,
                  suspendPayload: payload.suspendPayload,
                };
                break;
              }

              if (value.type === 'workflow-finish') {
                observed = {
                  status: payload.status === 'failed' ? 'failed' : 'success',
                  result: payload.result,
                  error: payload.error,
                  state: (payload.state ?? {}) as Record<string, unknown>,
                  steps: (payload.steps as Record<string, unknown>) ?? steps,
                };
                break;
              }
            }
          } finally {
            reader.releaseLock();
            await readable.cancel().catch(() => {});
          }

          const result = self.#toWorkflowResult(
            observed ?? {
              status: 'failed',
              error: { message: `Workflow run ${self.runId} ended without reporting a result` },
              state: {},
              steps,
            },
            inputData,
            Boolean(args.outputOptions?.includeState),
          );
          self.streamOutput?.updateResults(result);
          close();
        } catch (error) {
          self.streamOutput?.rejectResults(error as Error);
          close();
        }
      },
    });

    this.streamOutput = new WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>>({
      runId: this.runId,
      workflowId: this.workflowId,
      stream,
    });

    return this.streamOutput;
  }

  async cancel(): Promise<void> {
    const sdkRunId = await this.#resolveSdkRunId();
    if (!sdkRunId) {
      throw this.#unknownSdkRunError('cancel');
    }
    await getRun(sdkRunId).cancel();

    // Mirror the outcome so a reader of storage does not keep seeing the run as
    // still going. Best-effort, matching every other snapshot write here.
    try {
      const store = await this.#workflowsStore();
      const snapshot = await store?.loadWorkflowSnapshot({ workflowName: this.workflowId, runId: this.runId });
      if (store && snapshot) {
        await store.persistWorkflowSnapshot({
          workflowName: this.workflowId,
          runId: this.runId,
          resourceId: this.resourceId,
          snapshot: { ...snapshot, status: 'canceled' },
        });
      }
    } catch {
      // Storage is optional for Workflow SDK-backed runs.
    }
  }

  timeTravel(): never {
    throw unsupported('timeTravel()');
  }

  timeTravelStream(): never {
    throw unsupported('timeTravelStream()');
  }

  streamLegacy(): never {
    throw unsupported('streamLegacy()');
  }
}

/**
 * Number of chunks already written to a run's Mastra event stream.
 *
 * Used as the starting cursor when attaching to a run this process did not
 * start, so only events produced from that point on are read.
 */
async function tailIndexOf(sdkRunId: string): Promise<number> {
  const readable = getRun(sdkRunId).getReadable({ namespace: MASTRA_EVENT_NAMESPACE });
  try {
    // `getTailIndex()` is the 0-based index of the last chunk, or -1 when the
    // stream is empty; the cursor is the count, so one past it.
    return (await readable.getTailIndex()) + 1;
  } catch {
    return 0;
  } finally {
    await readable.cancel().catch(() => {});
  }
}

/** Normalizes the several shapes `resume({ step })` accepts down to one id. */
function resolveStepId(
  step: Step<string, any, any, any, any> | Step<string, any, any, any, any>[] | string | string[] | undefined,
): string | undefined {
  if (!step) {
    return undefined;
  }
  if (typeof step === 'string') {
    // Nested paths like "outer.inner" are not reachable yet; take the head.
    return step.split('.')[0];
  }
  if (Array.isArray(step)) {
    const first = step[0];
    return typeof first === 'string' ? first : first?.id;
  }
  return step.id;
}
