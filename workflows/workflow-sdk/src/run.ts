import type { ActorSignal } from '@mastra/core/auth/ee';
import { RequestContext } from '@mastra/core/di';
import { getErrorFromUnknown } from '@mastra/core/error';
import { EntityType, SpanType, getOrCreateSpan } from '@mastra/core/observability';
import type { TracingOptions } from '@mastra/core/observability';
import { WorkflowRunOutput, ChunkFrom } from '@mastra/core/stream';
import { Run, createRestartExecutionParams, createTimeTravelExecutionParams } from '@mastra/core/workflows';
import type {
  Step,
  TimeTravelContext,
  WorkflowResult,
  WorkflowResumeLabel,
  WorkflowRunStartOptions,
  WorkflowRunState,
  WorkflowStreamEvent,
} from '@mastra/core/workflows';
import { getRun, resumeHook, start as startWorkflowSdkRun } from 'workflow/api';
import { MASTRA_EVENT_NAMESPACE, PER_STEP_TOKEN_KEY } from './constants';
import { readSdkRunId, readSuspendTokens, withSdkRunId } from './snapshot';
import type { WorkflowSdkEngineType, MastraRunnerParams, SerializedOpError, WorkflowSdkRunnerRef } from './types';
import { suspendToken, type WalkerParams } from './workflows/walker';

type WorkflowSdkRunStartArgs<TState, TInput, TRequestContext> = {
  inputData?: TInput;
  initialState?: TState;
  requestContext?: RequestContext<TRequestContext>;
  /**
   * Only read by {@link WorkflowSdkRun.stream}. When `false` the readable stays
   * open across suspensions and keeps delivering events after `resume()`,
   * settling only on the terminal `workflow-finish`. Defaults to `true`.
   */
  closeOnSuspend?: boolean;
} & WorkflowRunStartOptions;

/** Shared by {@link WorkflowSdkRun.timeTravel} and {@link WorkflowSdkRun.timeTravelStream}. */
type WorkflowSdkTimeTravelArgs<TTravelInput, TState, TRequestContext> = {
  inputData?: TTravelInput;
  resumeData?: any;
  initialState?: TState;
  step:
    | Step<string, any, any, any, any, any, WorkflowSdkEngineType, any>
    | Step<string, any, any, any, any, any, WorkflowSdkEngineType, any>[]
    | string
    | string[];
  context?: TimeTravelContext<any, any, any, any>;
  nestedStepsContext?: Record<string, TimeTravelContext<any, any, any, any>>;
  requestContext?: RequestContext<TRequestContext>;
  tracingOptions?: TracingOptions;
  outputOptions?: {
    includeState?: boolean;
    includeResumeLabels?: boolean;
  };
  perStep?: boolean;
  actor?: ActorSignal;
};

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
  status: 'success' | 'failed' | 'suspended' | 'canceled' | 'paused';
  result?: unknown;
  error?: SerializedOpError;
  state: Record<string, unknown>;
  steps: Record<string, unknown>;
  suspendedStepId?: string;
  /** Every step parked when the run quiesced, in park order. */
  suspendedStepIds?: string[];
  suspendPayload?: unknown;
}

function unsupported(feature: string): Error {
  return new Error(`${feature} is not yet supported by @mastra/workflow-sdk.`);
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
    tracingOptions?: TracingOptions,
    actor?: ActorSignal,
    perStep?: boolean,
  ): WalkerParams {
    // Root span for the whole run, created here because this is the last point
    // with a live Mastra instance before execution crosses into the sandbox.
    // Ops correlate to it by ids (see `MastraTracingIds`); the finalize op
    // rebuilds it from the exported form and ends it.
    const workflowSpan = getOrCreateSpan({
      type: SpanType.WORKFLOW_RUN,
      name: `workflow run: '${this.workflowId}'`,
      entityType: EntityType.WORKFLOW_RUN,
      entityId: this.workflowId,
      entityName: this.workflowId,
      input: inputData,
      metadata: {
        resourceId: this.resourceId,
        runId: this.runId,
      },
      tracingOptions,
      requestContext: requestContext as RequestContext,
      mastra: this.mastra,
    });
    const exportedSpan = workflowSpan?.exportSpan();

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
      ...(this.disableScorers === undefined ? {} : { disableScorers: this.disableScorers }),
      ...(perStep ? { perStep: true } : {}),
      ...(actor === undefined ? {} : { actor }),
      ...(exportedSpan
        ? {
            tracingIds: { traceId: exportedSpan.traceId, workflowSpanId: exportedSpan.id },
            workflowSpanData: exportedSpan as unknown as Record<string, unknown>,
          }
        : {}),
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
    // Track this reader's absolute position locally; a `stream({ closeOnSuspend:
    // false })` reader may be consuming the same event stream concurrently, and
    // blind `#streamCursor += 1` from two readers would double-count.
    let cursor = this.#streamCursor;

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
        cursor += 1;
        this.#streamCursor = Math.max(this.#streamCursor, cursor);
        if (!value || typeof value.type !== 'string') {
          continue;
        }

        const payload = (value.payload ?? {}) as Record<string, any>;

        if (value.type === 'workflow-step-result' || value.type === 'workflow-step-suspended') {
          if (typeof payload.id === 'string') {
            steps[payload.id] = { ...payload };
          }
        }

        // Individual step suspensions only feed the steps map. The run settles
        // on the aggregate event below, which the walker emits once every
        // concurrent branch has either parked or finished — returning on the
        // first step suspension would hide a parallel sibling's suspension.
        if (value.type === 'workflow-suspension-settled') {
          const suspendedEntries = collectSuspendedEntries(payload);
          for (const entry of suspendedEntries) {
            steps[entry.id] = { status: 'suspended', ...entry };
            markSuspendedAncestors(steps, entry);
          }
          return {
            status: 'suspended',
            state: {},
            steps,
            suspendedStepId: suspendedEntries[0]?.id,
            suspendedStepIds: suspendedEntries.map(entry => entry.id),
            suspendPayload: suspendedEntries[0]?.suspendPayload,
          };
        }

        // perStep pause: the walker parked on the pause hook after persisting
        // the snapshot, so the run is settled for this turn.
        if (value.type === 'workflow-paused') {
          return {
            status: 'paused',
            state: (payload.state ?? {}) as Record<string, unknown>,
            steps: (payload.steps as Record<string, unknown>) ?? steps,
          };
        }

        if (value.type === 'workflow-finish') {
          return {
            status: payload.status === 'failed' ? 'failed' : payload.status === 'canceled' ? 'canceled' : 'success',
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
    const steps = reviveStepErrors(observed.steps);
    // Runs settled from the event stream (suspended runs) never see the walker's
    // final steps payload, so mirror the default engine's `steps.input` here.
    if (!('input' in steps) && inputData !== undefined) {
      steps.input = inputData;
    }
    const base = {
      input: inputData as TInput,
      steps: steps as never,
      ...(includeState ? { state: observed.state as TState } : {}),
    };

    if (observed.status === 'suspended') {
      return {
        ...base,
        status: 'suspended',
        suspendPayload: observed.suspendPayload,
        // Dotted nested ids surface as paths, matching the default engine's
        // `suspended` shape: [['outer-wf', 'inner-step']]. Deduped because
        // several foreach iterations of one step park under the same id.
        suspended: [...new Set(observed.suspendedStepIds ?? [observed.suspendedStepId ?? ''])].map(id =>
          id.split('.'),
        ) as [string[], ...string[][]],
      } as WorkflowResult<TState, TInput, TOutput, TSteps>;
    }

    if (observed.status === 'failed') {
      return {
        ...base,
        status: 'failed',
        error: getErrorFromUnknown(observed.error ?? new Error('Workflow failed'), { serializeStack: false }),
      } as WorkflowResult<TState, TInput, TOutput, TSteps>;
    }

    if (observed.status === 'paused') {
      // Like `canceled`, `paused` is not a `WorkflowResult` member; the default
      // engine returns this shape through the same cast, with no `result` key.
      return {
        ...base,
        status: 'paused',
      } as unknown as WorkflowResult<TState, TInput, TOutput, TSteps>;
    }

    if (observed.status === 'canceled') {
      // `WorkflowResult` has no `canceled` member; the default engine returns
      // this shape through the same cast when a run is aborted.
      return {
        ...base,
        status: 'canceled',
      } as unknown as WorkflowResult<TState, TInput, TOutput, TSteps>;
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

    const params = this.#buildRunnerParams(
      inputData,
      initialState,
      args.requestContext,
      args.tracingOptions,
      args.actor,
      args.perStep,
    );
    const sdkRunId = await this.#startSdkRun(params);

    const observed = await this.#observeUntilSettled(sdkRunId);
    const result = this.#toWorkflowResult(observed, inputData, Boolean(args.outputOptions?.includeState));

    // Suspended and paused runs stay alive inside the Workflow SDK.
    if (result.status !== 'suspended' && result.status !== 'paused') {
      this.cleanup?.();
    }
    return result;
  }

  /** Starts the run and returns as soon as it is enqueued. */
  async startAsync(args: WorkflowSdkRunStartArgs<TState, TInput, TRequestContext> = {}): Promise<{ runId: string }> {
    const inputData = await this._validateInput(args.inputData);
    const initialState = await this._validateInitialState(args.initialState ?? ({} as TState));

    const params = this.#buildRunnerParams(
      inputData,
      initialState,
      args.requestContext,
      args.tracingOptions,
      args.actor,
      args.perStep,
    );
    await this.#startSdkRun(params);

    return { runId: this.runId };
  }

  /**
   * The snapshot state `resume()` needs: which steps are parked, on which
   * tokens, and under which labels.
   *
   * `available: false` means storage is missing or unreadable — resume then
   * requires an explicit step and falls back to reconstructed first-park
   * tokens, which keeps plain top-level resumes working storage-free.
   */
  async #loadResumeState(): Promise<{
    available: boolean;
    suspendTokens: Record<string, string>;
    suspendedIds: string[];
    resumeLabels: Record<string, WorkflowResumeLabel>;
  }> {
    try {
      const store = await this.#workflowsStore();
      const snapshot = await store?.loadWorkflowSnapshot({ workflowName: this.workflowId, runId: this.runId });
      if (snapshot) {
        return {
          available: true,
          suspendTokens: readSuspendTokens(snapshot),
          suspendedIds: Object.keys(snapshot.suspendedPaths ?? {}),
          resumeLabels: (snapshot.resumeLabels ?? {}) as Record<string, WorkflowResumeLabel>,
        };
      }
    } catch {
      // Storage is optional for Workflow SDK-backed runs.
    }
    return { available: false, suspendTokens: {}, suspendedIds: [], resumeLabels: {} };
  }

  /** The `Step` a dotted path names, descending through nested workflows. */
  #findStepByPath(stepPath: string): Step<string, any, any, any, any> | undefined {
    let steps: Record<string, unknown> | undefined = this.workflowSteps;
    let step: Step<string, any, any, any, any> | undefined;
    for (const segment of stepPath.split('.')) {
      step = steps?.[segment] as Step<string, any, any, any, any> | undefined;
      if (!step) {
        return undefined;
      }
      steps = (step as { steps?: Record<string, unknown> }).steps;
    }
    return step;
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
    label?: string;
    forEachIndex?: number;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const { available, suspendTokens, suspendedIds, resumeLabels } = await this.#loadResumeState();

    // perStep pause continuation. A paused run parked on the pause hook, not
    // on a step's suspend hook: resolving it grants the walker one more step,
    // after which it pauses again (or finishes/suspends). Runs with actual
    // suspended steps fall through to normal resume below.
    const parkedPauseToken = suspendTokens[PER_STEP_TOKEN_KEY];
    if (parkedPauseToken && suspendedIds.length === 0 && !params.step && !params.label) {
      const sdkRunId = await this.#resolveSdkRunId();
      if (!sdkRunId) {
        throw this.#unknownSdkRunError('resume');
      }
      await resumeHook(parkedPauseToken, undefined);
      const observed = await this.#observeUntilSettled(sdkRunId);
      return this.#toWorkflowResult(observed, undefined, false);
    }

    // A label recorded at suspend time (`suspend(payload, { resumeLabel })`)
    // names its step and foreach iteration; an explicit `step` wins over
    // auto-detection but not over a matched label, mirroring the default
    // engine's precedence.
    let forEachIndex = params.forEachIndex;
    const labelTarget = params.label ? resumeLabels[params.label] : undefined;
    let requestedId = labelTarget?.stepId ?? resolveStepId(params.step);
    if (labelTarget && forEachIndex === undefined) {
      forEachIndex = labelTarget.foreachIndex;
    }

    if (!requestedId) {
      if (!available) {
        throw new Error(
          'resume() requires a `step` for Workflow SDK-backed workflows without storage: the hook ' +
            'token that parks a suspended step is derived from its id.',
        );
      }
      if (suspendedIds.length === 0) {
        throw new Error('No suspended steps found in this workflow run');
      }
      if (suspendedIds.length > 1) {
        const pathStrings = suspendedIds.map(id => `[${id.split('.').join(', ')}]`);
        throw new Error(
          `Multiple suspended steps found: ${pathStrings.join(', ')}. ` +
            'Please specify which step to resume using the "step" parameter.',
        );
      }
      requestedId = suspendedIds[0]!;
    }

    // A nested workflow suspends on its inner step's dotted path, so a caller
    // naming just the wrapper (`step: nestedWorkflow`) or a partial path is
    // completed against the suspended paths recorded in the snapshot.
    const stepId = completeSuspendedPath(requestedId, suspendedIds);

    // Without this guard a wrong step would park the caller on a hook that was
    // never registered and surface as the SDK's opaque "Hook not found".
    // Storage-free runs skip it — the snapshot is the only record of what is
    // suspended.
    if (available && !suspendedIds.includes(stepId)) {
      throw new Error(
        `This workflow step "${stepId}" was not suspended. Available suspended steps: [${suspendedIds.join(', ')}]`,
      );
    }

    const suspendedStep = this.#findStepByPath(stepId);
    const resumeData = await this._validateResumeData(params.resumeData, suspendedStep);
    // The snapshot's tokens are the ones the walker is actually parked on —
    // hook tokens are single-use, so a step suspended for the second time
    // waits on a sequenced token that cannot be rebuilt from run and step ids
    // alone. Reconstruction stays as the storage-free fallback.
    //
    // A foreach step parks one hook per suspended iteration under
    // `stepId:index` keys. With no `forEachIndex` to narrow it, every parked
    // iteration is resumed with the same payload — the default engine's
    // behavior for resuming a suspended foreach.
    const tokenKey = forEachIndex === undefined ? stepId : `${stepId}:${forEachIndex}`;
    let tokens: string[];
    if (suspendTokens[tokenKey]) {
      tokens = [suspendTokens[tokenKey]];
    } else if (forEachIndex === undefined) {
      const iterationTokens = Object.entries(suspendTokens)
        .filter(([key]) => key.startsWith(`${stepId}:`))
        .map(([, parkedToken]) => parkedToken);
      tokens = iterationTokens.length > 0 ? iterationTokens : [suspendToken(this.runId, stepId)];
    } else {
      tokens = [suspendToken(this.runId, stepId, forEachIndex)];
    }

    // Resolved before the resume so the stream cursor is parked at the tail
    // while the run is still suspended, and no post-resume event is missed.
    const sdkRunId = await this.#resolveSdkRunId();
    if (!sdkRunId) {
      throw this.#unknownSdkRunError('resume');
    }

    await Promise.all(tokens.map(token => resumeHook(token, resumeData)));

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
          if (value && (value as { type?: string }).type !== 'workflow-suspension-settled') {
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

    this.streamOutput = this.#createStream({
      prepare: async () => {
        const inputData = await this._validateInput(args.inputData);
        const initialState = await this._validateInitialState(args.initialState ?? ({} as TState));
        return {
          params: this.#buildRunnerParams(
            inputData,
            initialState,
            args.requestContext,
            args.tracingOptions,
            args.actor,
            args.perStep,
          ),
          inputData,
        };
      },
      closeOnSuspend: args.closeOnSuspend ?? true,
      includeState: Boolean(args.outputOptions?.includeState),
    });
    return this.streamOutput;
  }

  /**
   * Shared stream machinery for {@link stream} and {@link timeTravelStream}:
   * starts the Workflow SDK run described by `prepare()` and surfaces its
   * event stream, settling on suspension, pause or the terminal finish.
   */
  #createStream(opts: {
    prepare: () => Promise<{ params: WalkerParams; inputData: TInput | undefined }>;
    closeOnSuspend: boolean;
    includeState: boolean;
    /** The run replaces an earlier one, so its event stream restarts at zero. */
    freshRun?: boolean;
  }): WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>> {
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
          const { params, inputData } = await opts.prepare();
          const sdkRunId = await self.#startSdkRun(params);
          if (opts.freshRun) {
            self.#streamCursor = 0;
          }

          const closeOnSuspend = opts.closeOnSuspend;
          const readable = getRun(sdkRunId).getReadable<Record<string, any>>({
            namespace: MASTRA_EVENT_NAMESPACE,
            startIndex: self.#streamCursor,
          });
          const reader = readable.getReader();
          const steps: Record<string, unknown> = {};
          let observed: ObservedRun | undefined;
          // Local absolute position; see #observeUntilSettled. With
          // `closeOnSuspend: false` this reader outlives a suspension, so a
          // concurrent `resume()` observer may be reading the same stream.
          let cursor = self.#streamCursor;

          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              cursor += 1;
              self.#streamCursor = Math.max(self.#streamCursor, cursor);
              if (!value || typeof value.type !== 'string') {
                continue;
              }

              const payload = (value.payload ?? {}) as Record<string, any>;

              // Run-level quiescence marker: internal to the engine, so it is
              // consumed here (to settle the stream) but never surfaced.
              if (value.type === 'workflow-suspension-settled') {
                if (!closeOnSuspend) {
                  // Keep the readable open across the suspension; events resume
                  // flowing once the run is resumed, and the stream settles on
                  // the terminal finish event instead.
                  continue;
                }
                const suspendedEntries = collectSuspendedEntries(payload);
                for (const entry of suspendedEntries) {
                  steps[entry.id] = { status: 'suspended', ...entry };
                  markSuspendedAncestors(steps, entry);
                }
                observed = {
                  status: 'suspended',
                  state: {},
                  steps,
                  suspendedStepId: suspendedEntries[0]?.id,
                  suspendedStepIds: suspendedEntries.map(entry => entry.id),
                  suspendPayload: suspendedEntries[0]?.suspendPayload,
                };
                break;
              }

              // perStep pause: settle the stream like a suspension — the run
              // stays alive parked on the pause hook. The event itself is
              // engine-internal and never surfaced.
              if (value.type === 'workflow-paused') {
                observed = {
                  status: 'paused',
                  state: (payload.state ?? {}) as Record<string, unknown>,
                  steps: (payload.steps as Record<string, unknown>) ?? steps,
                };
                break;
              }

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

              if (value.type === 'workflow-finish') {
                observed = {
                  status:
                    payload.status === 'failed' ? 'failed' : payload.status === 'canceled' ? 'canceled' : 'success',
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
            opts.includeState,
          );
          self.streamOutput?.updateResults(result);
          close();
        } catch (error) {
          self.streamOutput?.rejectResults(error as Error);
          close();
        }
      },
    });

    return new WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>>({
      runId: this.runId,
      workflowId: this.workflowId,
      stream,
    });
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

  /**
   * Re-runs this workflow run after an interruption (e.g. the process died
   * mid-run and storage still says `running`).
   *
   * Host-side this mirrors the default engine's `_restart`: the same
   * `createRestartExecutionParams` validates the run was active and seeds the
   * historical step results from the snapshot. A *fresh* Workflow SDK run is
   * started with that payload — the walker settles seeded steps from their
   * results (no ops, no events) and executes every step that was still active
   * or unreached, so the new journal stays deterministic.
   */
  async restart(
    args: {
      requestContext?: RequestContext<TRequestContext>;
      tracingOptions?: TracingOptions;
      actor?: ActorSignal;
    } = {},
  ): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const store = await this.#workflowsStore();
    const snapshot = await store?.loadWorkflowSnapshot({ workflowName: this.workflowId, runId: this.runId });
    if (!snapshot) {
      throw new Error(`Snapshot not found for run ${this.runId}`);
    }

    // Same helper as the default engine: throws unless the run was active
    // (`running`/`waiting`, or `pending` with input for a nested handoff).
    const restartData = createRestartExecutionParams({ snapshot, graph: this.executionGraph });

    // The walker only knows the flat dotted-id step-results map. A run
    // interrupted by the default engine keeps each nested workflow's progress
    // in its own snapshot (the wrapper result carries `metadata.nestedRunId`),
    // so those contexts seed under the wrapper's prefix, recursively.
    const seededStepResults: Record<string, unknown> = { ...((restartData.stepResults ?? {}) as object) };
    // Nested runs interrupted by the default engine have their own snapshots
    // still marked active. The restarted walk executes them inline, so once it
    // settles those snapshots are finalized here on the host.
    const nestedRuns: { workflowName: string; runId: string; wrapperId: string }[] = [];
    const seedNested = async (context: Record<string, unknown>, prefix: string): Promise<void> => {
      for (const [stepId, result] of Object.entries(context)) {
        if (stepId === 'input' || !result || typeof result !== 'object') {
          continue;
        }
        const nestedRunId = (result as { metadata?: { nestedRunId?: string } }).metadata?.nestedRunId;
        if (!nestedRunId) {
          continue;
        }
        const nested = await store
          ?.loadWorkflowSnapshot({ workflowName: stepId, runId: nestedRunId })
          .catch(() => null);
        if (!nested?.context) {
          continue;
        }
        nestedRuns.push({ workflowName: stepId, runId: nestedRunId, wrapperId: `${prefix}${stepId}` });
        for (const [innerId, innerResult] of Object.entries(nested.context)) {
          if (innerId !== 'input') {
            seededStepResults[`${prefix}${stepId}.${innerId}`] = innerResult;
          }
        }
        await seedNested(nested.context as Record<string, unknown>, `${prefix}${stepId}.`);
      }
    };
    await seedNested((snapshot.context ?? {}) as Record<string, unknown>, '');

    const inputData = seededStepResults.input as TInput | undefined;

    // Historical request context rides under the caller's, like the default engine.
    const requestContextToUse = args.requestContext ?? new RequestContext();
    for (const [key, value] of Object.entries(snapshot.requestContext ?? {})) {
      if (!(requestContextToUse as RequestContext).has(key)) {
        (requestContextToUse as RequestContext).set(key, value);
      }
    }

    // A restart replaces this run's execution. The previous Workflow SDK run
    // may still be alive (that's what a restart recovers from), and the new
    // walk needs the same suspend-hook tokens, so cancel it first.
    // Best-effort: a dead or finished run has nothing left to cancel.
    const previousSdkRunId = await this.#resolveSdkRunId().catch(() => undefined);
    if (previousSdkRunId) {
      try {
        await getRun(previousSdkRunId).cancel();
      } catch {
        // Already settled, or unreachable; the new run supersedes it either way.
      }
    }

    const params = this.#buildRunnerParams(
      inputData,
      (restartData.state ?? {}) as TState,
      requestContextToUse as RequestContext<TRequestContext>,
      args.tracingOptions,
      args.actor,
    );
    params.restart = { stepResults: seededStepResults };

    const sdkRunId = await this.#startSdkRun(params);
    // The replacement run's event stream starts from scratch.
    this.#streamCursor = 0;
    const observed = await this.#observeUntilSettled(sdkRunId);
    const result = this.#toWorkflowResult(observed, inputData, false);

    // A run settled from the event stream (suspended/paused) only saw events
    // for steps that actually executed; bypassed steps emit none. Their seeded
    // results ride underneath so the caller still sees the full picture.
    if (result.status === 'suspended' || result.status === 'paused') {
      result.steps = { ...seededStepResults, ...result.steps } as typeof result.steps;
    }

    // The restarted walk ran interrupted nested workflows inline; sync their
    // still-active standalone snapshots to the wrapper step's final state so
    // storage agrees with the result (mirrors the default engine, which
    // restarts nested runs through their own snapshots).
    if (result.status === 'success' || result.status === 'failed') {
      for (const nestedRun of nestedRuns) {
        const wrapper = (result.steps as Record<string, { status?: string } | undefined>)[nestedRun.wrapperId];
        const wrapperStatus = wrapper?.status;
        if (wrapperStatus !== 'success' && wrapperStatus !== 'failed') {
          continue;
        }
        const nested = await store
          ?.loadWorkflowSnapshot({ workflowName: nestedRun.workflowName, runId: nestedRun.runId })
          .catch(() => null);
        if (!nested) {
          continue;
        }
        const nestedContext = { ...(nested.context ?? {}) } as Record<string, unknown>;
        const prefixDot = `${nestedRun.wrapperId}.`;
        for (const [id, stepResult] of Object.entries(result.steps as Record<string, unknown>)) {
          if (id.startsWith(prefixDot) && !id.slice(prefixDot.length).includes('.')) {
            nestedContext[id.slice(prefixDot.length)] = stepResult;
          }
        }
        await store
          ?.persistWorkflowSnapshot({
            workflowName: nestedRun.workflowName,
            runId: nestedRun.runId,
            snapshot: {
              ...nested,
              status: wrapperStatus,
              context: nestedContext as WorkflowRunState['context'],
              timestamp: Date.now(),
            },
          })
          .catch(() => {});
      }
    }

    // Suspended and paused runs stay alive inside the Workflow SDK.
    if (result.status !== 'suspended' && result.status !== 'paused') {
      this.cleanup?.();
    }
    return result;
  }

  /**
   * Re-runs this workflow run from an arbitrary step.
   *
   * Host-side this mirrors the default engine's `_timeTravel`: the same
   * snapshot validation and the same `createTimeTravelExecutionParams` compute
   * which steps are bypassed and with which seeded results. The outcome is
   * translated into a serializable payload and a *fresh* Workflow SDK run is
   * started with it — the walker then bypasses every entry before the target
   * (no ops, no events) and executes normally from the target on, so the new
   * journal stays deterministic.
   */
  async timeTravel<TTravelInput = unknown>(
    args: WorkflowSdkTimeTravelArgs<TTravelInput, TState, TRequestContext>,
  ): Promise<WorkflowResult<TState, TTravelInput, TOutput, TSteps>> {
    const { params, timeTravelInput } = await this.#prepareTimeTravel(args);

    const sdkRunId = await this.#startSdkRun(params);
    // The replacement run's event stream starts from scratch.
    this.#streamCursor = 0;
    const observed = await this.#observeUntilSettled(sdkRunId);
    const result = this.#toWorkflowResult(observed, timeTravelInput, Boolean(args.outputOptions?.includeState));

    // Suspended and paused runs stay alive inside the Workflow SDK.
    if (result.status !== 'suspended' && result.status !== 'paused') {
      this.cleanup?.();
    }
    return result as unknown as WorkflowResult<TState, TTravelInput, TOutput, TSteps>;
  }

  /**
   * Streaming flavor of {@link timeTravel}: identical preparation, but the
   * replacement run's events are surfaced through a `WorkflowRunOutput` the
   * same way {@link stream} surfaces a fresh run's.
   */
  timeTravelStream<TTravelInput = unknown>(
    args: WorkflowSdkTimeTravelArgs<TTravelInput, TState, TRequestContext>,
  ): WorkflowRunOutput<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    this.streamOutput = this.#createStream({
      prepare: async () => {
        const { params, timeTravelInput } = await this.#prepareTimeTravel(args);
        return { params, inputData: timeTravelInput };
      },
      closeOnSuspend: true,
      includeState: Boolean(args.outputOptions?.includeState),
      freshRun: true,
    });
    return this.streamOutput;
  }

  /**
   * Everything `timeTravel` decides before execution starts: snapshot
   * validation, seeded step results and the runner params carrying the
   * serialized time-travel payload. Shared with `timeTravelStream`.
   */
  async #prepareTimeTravel(
    args: WorkflowSdkTimeTravelArgs<any, TState, TRequestContext>,
  ): Promise<{ params: WalkerParams; timeTravelInput: TInput | undefined }> {
    const stepParam = args.step;
    if (!stepParam || (Array.isArray(stepParam) && stepParam.length === 0)) {
      throw new Error('Step is required and must be a valid step or array of steps');
    }

    const store = await this.#workflowsStore();
    const snapshot = await store?.loadWorkflowSnapshot({ workflowName: this.workflowId, runId: this.runId });
    if (!snapshot) {
      throw new Error(`Snapshot not found for run ${this.runId}`);
    }
    if (snapshot.status === 'running') {
      throw new Error('This workflow run is still running, cannot time travel');
    }

    const segments = typeof stepParam === 'string' ? stepParam.split('.') : stepParam;
    const steps = (Array.isArray(segments) ? segments : [segments]).map(step =>
      typeof step === 'string' ? step : step?.id,
    );

    let inputDataToUse: unknown = args.inputData;
    if (inputDataToUse && steps.length === 1) {
      const targetStep = this.workflowSteps[steps[0]!];
      if (!targetStep) {
        throw new Error(
          `Step "${steps[0]}" not found in workflow "${this.workflowId}". ` +
            `Known steps: ${Object.keys(this.workflowSteps).join(', ')}`,
        );
      }
      inputDataToUse = await this._validateTimetravelInputData(inputDataToUse, targetStep);
    }

    const timeTravelData = createTimeTravelExecutionParams({
      steps,
      inputData: inputDataToUse,
      resumeData: args.resumeData,
      context: args.context,
      nestedStepsContext: args.nestedStepsContext,
      snapshot,
      initialState: args.initialState,
      graph: this.executionGraph,
      perStep: args.perStep,
    });

    // Historical request context rides under the caller's, like the default engine.
    const requestContextToUse = args.requestContext ?? new RequestContext();
    for (const [key, value] of Object.entries(snapshot.requestContext ?? {})) {
      if (!(requestContextToUse as RequestContext).has(key)) {
        (requestContextToUse as RequestContext).set(key, value);
      }
    }

    // The walker only knows the flat dotted-id step-results map, so nested
    // results seed under their wrapper's prefix.
    const seededStepResults: Record<string, unknown> = { ...timeTravelData.stepResults };
    for (const [wrapperId, nested] of Object.entries(timeTravelData.nestedStepResults ?? {})) {
      for (const [stepId, result] of Object.entries(nested as Record<string, unknown>)) {
        seededStepResults[`${wrapperId}.${stepId}`] = result;
      }
    }
    const timeTravelInput = seededStepResults.input as TInput | undefined;

    // A time travel replaces this run's execution. The previous Workflow SDK
    // run may still be parked on suspend hooks whose tokens the new walk will
    // need again (tokens derive from the Mastra run and step ids), so cancel
    // it before starting the replacement. Best-effort: a finished run has
    // nothing left to cancel.
    const previousSdkRunId = await this.#resolveSdkRunId().catch(() => undefined);
    if (previousSdkRunId) {
      try {
        await getRun(previousSdkRunId).cancel();
      } catch {
        // Already settled, or unreachable; the new run supersedes it either way.
      }
    }

    const params = this.#buildRunnerParams(
      timeTravelInput,
      (timeTravelData.state ?? {}) as TState,
      requestContextToUse as RequestContext<TRequestContext>,
      args.tracingOptions,
      args.actor,
      args.perStep,
    );
    params.timeTravel = {
      steps: timeTravelData.steps,
      stepResults: seededStepResults,
      ...(timeTravelData.resumeData === undefined ? {} : { resumeData: timeTravelData.resumeData }),
    };

    return { params, timeTravelInput };
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

/**
 * Normalizes the several shapes `resume({ step })` accepts down to one dotted
 * path: `'step'`, `'outer.inner'`, `[outerWorkflow, innerStep]` and mixes of
 * step instances and strings all collapse to their dotted id chain.
 */
function resolveStepId(
  step: Step<string, any, any, any, any> | Step<string, any, any, any, any>[] | string | string[] | undefined,
): string | undefined {
  if (!step) {
    return undefined;
  }
  if (typeof step === 'string') {
    return step;
  }
  if (Array.isArray(step)) {
    const ids = step.map(part => (typeof part === 'string' ? part : part?.id)).filter(Boolean);
    return ids.length > 0 ? ids.join('.') : undefined;
  }
  return step.id;
}

/**
 * Completes a caller-supplied step id against the run's suspended paths.
 *
 * Suspended nested steps park on their full dotted path (`outer.inner`), but
 * callers may name only the wrapper workflow, a partial path, or the inner
 * step alone. Without a match the id is used as given, which keeps plain
 * top-level resumes working storage-free.
 */
function completeSuspendedPath(requestedId: string, suspendedIds: string[]): string {
  if (suspendedIds.includes(requestedId)) {
    return requestedId;
  }
  return suspendedIds.find(id => id.startsWith(`${requestedId}.`) || id.endsWith(`.${requestedId}`)) ?? requestedId;
}

/**
 * Step errors travel the event stream as serialized objects, but callers of
 * `start()`/`resume()` expect `Error` instances on failed step results — the
 * same shape the default engine returns.
 */
function reviveStepErrors(steps: Record<string, unknown>): Record<string, unknown> {
  const revived: Record<string, unknown> = {};
  for (const [id, entry] of Object.entries(steps)) {
    const step = entry as { error?: unknown } | null;
    revived[id] =
      step && step.error !== undefined && !(step.error instanceof Error)
        ? { ...step, error: getErrorFromUnknown(step.error, { serializeStack: false }) }
        : entry;
  }
  return revived;
}

/**
 * Reads the parked-step list off a `workflow-suspension-settled` payload,
 * dropping anything that does not look like a step entry.
 */
function collectSuspendedEntries(
  payload: Record<string, any>,
): { id: string; suspendPayload?: unknown; payload?: unknown }[] {
  const raw = Array.isArray(payload.suspended) ? payload.suspended : [];
  return raw.filter((entry: unknown): entry is { id: string } => {
    return Boolean(entry) && typeof (entry as { id?: unknown }).id === 'string';
  });
}

/**
 * A nested step's suspension suspends every wrapper step above it too: a
 * caller inspecting `steps['outer-wf']` must see the nested workflow step as
 * suspended, exactly as the default engine reports it.
 */
function markSuspendedAncestors(steps: Record<string, unknown>, payload: Record<string, any>): void {
  if (typeof payload.id !== 'string' || !payload.id.includes('.')) {
    return;
  }
  const segments = payload.id.split('.');
  for (let depth = 1; depth < segments.length; depth++) {
    const id = segments.slice(0, depth).join('.');
    steps[id] = {
      id,
      status: 'suspended',
      // Match the default engine's wrapper-step shape: the user payload plus
      // metadata pathing from this wrapper down to the step that suspended.
      suspendPayload: {
        ...(payload.suspendPayload as Record<string, unknown> | undefined),
        __workflow_meta: { path: segments.slice(depth) },
      },
    };
  }
}
