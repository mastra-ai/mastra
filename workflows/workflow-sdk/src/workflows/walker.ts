import { FINALIZE_IDENTITY, PAUSE_IDENTITY_PREFIX } from '../constants';
import type {
  MastraOp,
  MastraOpRequest,
  MastraOpResponse,
  MastraRunnerParams,
  MastraRunnerResult,
  SerializedOpError,
} from '../types';

/**
 * Deterministic walker over a Mastra serialized step graph.
 *
 * This module runs inside the Workflow SDK's sandbox, so its only runtime
 * import is `../constants`, which is import-free for exactly this reason;
 * everything else it takes from the package is an erased `import type`. Every
 * effect it needs (running a Mastra callable, sleeping, waiting on a hook,
 * emitting events) is injected through {@link WalkerEffects}. That keeps both
 * `@mastra/core` and Node builtins out of the workflow bundle and makes the
 * walk unit-testable without a workflow runtime.
 */

/** Effects the walker needs from its host runtime. */
export interface WalkerEffects {
  /** Runs one Mastra callable on the host. Must be durable and replay-safe. */
  runOp(request: MastraOpRequest): Promise<MastraOpResponse>;
  /** Durable sleep, in milliseconds. */
  sleepMs(ms: number): Promise<void>;
  /**
   * Registers a hook under `token` and resolves with its resume payload.
   *
   * `onRegistered` runs once the hook is durably registered and before the
   * payload is awaited. The walker uses it to publish the suspended event, so a
   * caller that reacts to that event by resuming can never beat the
   * registration and get `HookNotFoundError`.
   */
  awaitResume(token: string, onRegistered: () => Promise<void>): Promise<unknown>;
  /** Publishes Mastra stream events for observers of this run. */
  emit(events: MastraStreamEventLike[]): Promise<void>;
}

/** Loose shape of a Mastra `WorkflowStreamEvent`, kept structural for the sandbox. */
export interface MastraStreamEventLike {
  type: string;
  runId?: string;
  from?: string;
  payload: Record<string, unknown>;
}

export interface WalkerParams extends MastraRunnerParams {
  /** Per-step retry attempts keyed by step id, resolved from the live graph. */
  stepRetries?: Record<string, number>;
  /** Workflow-level retry defaults, used when a step has no explicit count. */
  retryConfig?: { attempts?: number; delay?: number };
}

/**
 * Serialized graph entries, restated structurally.
 *
 * The walker cannot import `SerializedStepFlowEntry` as a value and does not
 * want `@mastra/core` in its type graph either, so it models only the fields it
 * actually reads.
 */
interface SerializedStepLike {
  id: string;
  /** Present only on nested workflow steps; holds the nested serialized graph. */
  serializedStepFlow?: unknown[];
  component?: string;
}

/**
 * Where in the workflow tree the walk currently is.
 *
 * The root graph walks with an empty scope. Entering a nested workflow step
 * pushes that step's path onto `workflowPath` and its qualified id onto
 * `prefix`, and swaps `initData` for the nested workflow's own input — which is
 * what `getInitData()` returns for steps inside it.
 */
interface WalkScope {
  /** Wrapper-step paths of enclosing nested workflows, outermost first. */
  workflowPath: number[][];
  /** Dotted qualified-id prefix (`""` at the root, `"outer"`, `"outer.inner"`, …). */
  prefix: string;
  /** The current workflow's own input. */
  initData: unknown;
}

/** Qualified id a step is known by outside its own graph. */
function qualifyId(scope: WalkScope, id: string): string {
  return scope.prefix ? `${scope.prefix}.${id}` : id;
}

type BranchEntry = { type: 'step'; step: SerializedStepLike };

type SerializedEntry =
  | BranchEntry
  | { type: 'sleep'; id: string; duration?: number; fn?: string }
  | { type: 'sleepUntil'; id: string; date?: string | Date; fn?: string }
  | { type: 'parallel'; steps: BranchEntry[] }
  | {
      type: 'conditional';
      steps: BranchEntry[];
      serializedConditions: { id: string; fn: string }[];
    }
  | {
      type: 'loop';
      step: SerializedStepLike;
      serializedCondition: { id: string; fn: string };
      loopType: 'dowhile' | 'dountil';
    }
  | { type: 'foreach'; step: SerializedStepLike; opts?: { concurrency?: number; fn?: string } };

/**
 * Normalizes core's raw `SerializedStepFlowEntry[]` into the walker's internal
 * model. Core carries two shapes the walker flattens away:
 *
 * - nested workflows are `{ type: 'workflow', id, serializedStepFlow }`
 *   entries; the walker keys nested workflows off `serializedStepFlow`
 *   presence on a step-like, so they normalize to a plain step wrapper.
 * - `loop` / `foreach` bodies and `parallel` / `conditional` branches carry a
 *   single-step-entry wrapper (`{ type: 'step', step }`) rather than the bare
 *   step the walker reads.
 *
 * Declarative entries (agent / tool / mapping) normalize to their bare id;
 * when one executes, the host rejects the op with an actionable error.
 */
function normalizeEntries(rawEntries: unknown[]): SerializedEntry[] {
  type Raw = { type?: string; id?: string; step?: unknown; steps?: unknown[]; serializedStepFlow?: unknown[] };

  const withNormalizedFlow = (step: SerializedStepLike): SerializedStepLike =>
    step?.serializedStepFlow ? { ...step, serializedStepFlow: normalizeEntries(step.serializedStepFlow) } : step;

  const normalizeStepLike = (raw: Raw): SerializedStepLike => {
    if (raw?.type === 'step' && raw.step) {
      return withNormalizedFlow(raw.step as SerializedStepLike);
    }
    if (raw?.type === 'workflow') {
      return raw.serializedStepFlow
        ? { id: raw.id!, serializedStepFlow: normalizeEntries(raw.serializedStepFlow) }
        : { id: raw.id! };
    }
    // Bare step-likes (older snapshots) and declarative entries both carry `id`.
    return withNormalizedFlow(raw as SerializedStepLike);
  };

  return (rawEntries as Raw[]).map(raw => {
    switch (raw.type) {
      case 'step':
      case 'workflow':
      case 'agent':
      case 'tool':
      case 'mapping':
        return { type: 'step', step: normalizeStepLike(raw) };
      case 'parallel':
      case 'conditional':
        return {
          ...raw,
          steps: (raw.steps ?? []).map(branch => ({ type: 'step', step: normalizeStepLike(branch as Raw) })),
        } as SerializedEntry;
      case 'loop':
      case 'foreach':
        return { ...raw, step: normalizeStepLike(raw.step as Raw) } as SerializedEntry;
      default:
        return raw as unknown as SerializedEntry;
    }
  });
}

/** Thrown by `bail()`; unwinds the walk and finishes the run early. */
class BailSignal {
  constructor(public readonly output: unknown) {}
}

/**
 * Thrown when a step called `abort()`; unwinds the whole walk — including any
 * nested workflow scopes — and finishes the run as `canceled`, matching the
 * default engine's between-steps abort check.
 */
class AbortRunSignal {}

/** Thrown when a step fails terminally; unwinds the walk into a failed result. */
class StepFailureSignal {
  constructor(public readonly error: SerializedOpError) {}
}

/**
 * Hook token that a suspended step waits on.
 *
 * `WorkflowSdkRun#resume()` reconstructs this from the run id and step id, so the
 * shape is part of the package's public contract. Foreach elements append their
 * index because several copies of one step can be suspended at once.
 *
 * `parkSeq` counts how many times this step has already parked in the run: a
 * hook token is consumed when it resolves, so a step suspending again — a loop
 * iteration, or suspend-after-resume — must park on a fresh token. The first
 * park keeps the bare token so pre-existing runs and callers stay compatible.
 */
export function suspendToken(runId: string, stepId: string, foreachIndex?: number, parkSeq?: number): string {
  const base = foreachIndex === undefined ? `mastra:${runId}:${stepId}` : `mastra:${runId}:${stepId}:${foreachIndex}`;
  return parkSeq ? `${base}~${parkSeq}` : base;
}

/**
 * Hook token a perStep pause waits on.
 *
 * Sequenced like suspend tokens: hook tokens are single-use, and a run in
 * perStep mode pauses once per remaining step. The current token is persisted
 * in the snapshot by the `pause` op, which is where `resume()` reads it from.
 */
export function pauseToken(runId: string, pauseSeq: number): string {
  return `mastra:${runId}:__perStep~${pauseSeq}`;
}

function unsupported(feature: string): Error {
  return new Error(
    `${feature} is not yet supported by @mastra/workflow-sdk. ` +
      `See the package README for the list of supported workflow features.`,
  );
}

export function toSerializedError(error: unknown): SerializedOpError {
  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; name?: unknown; stack?: unknown };
    if (typeof candidate.message === 'string') {
      return {
        message: candidate.message,
        name: typeof candidate.name === 'string' ? candidate.name : undefined,
        stack: typeof candidate.stack === 'string' ? candidate.stack : undefined,
      };
    }
  }
  return { message: String(error) };
}

/**
 * Walks `params.serializedStepGraph` to completion.
 *
 * Always resolves — failures come back as a `failed` result rather than a
 * rejection, so the Workflow SDK run itself completes and callers read the Mastra
 * status off the return value.
 */
export async function runMastraGraph(params: WalkerParams, effects: WalkerEffects): Promise<MastraRunnerResult> {
  const graph = normalizeEntries(params.serializedStepGraph ?? []);
  const state: Record<string, unknown> = { ...(params.initialState ?? {}) };
  // `input` mirrors the default engine's step-results shape: the workflow input
  // travels alongside step entries so `result.steps.input` and persisted
  // snapshots match what the default engine produces. A time-travelled or
  // restarted run additionally starts with the seeded historical results the
  // host computed from the source run's snapshot.
  const stepResults: Record<string, unknown> = {
    input: params.inputData,
    ...(params.timeTravel?.stepResults ?? {}),
    ...(params.restart?.stepResults ?? {}),
  };
  const initData = params.inputData;

  /**
   * Time-travel mode: while set, entries walk in bypass — their seeded results
   * stand in for execution, with no ops and no events — until the walk reaches
   * the target step named by `steps[0]`. Nested targets descend one segment
   * per wrapper. Cleared at the target; everything after runs normally.
   * Replay-stable because the payload rides in the run input.
   */
  let timeTravel: { steps: string[]; resumeData?: unknown } | undefined = params.timeTravel
    ? { steps: params.timeTravel.steps, resumeData: params.timeTravel.resumeData }
    : undefined;

  /**
   * Restart mode: steps the source run already completed settle from their
   * seeded results — no ops, no events — while steps that were active (or
   * never reached) execute normally. Unlike time travel there is no single
   * target: completion is judged per seeded step, for the whole walk, so a
   * restart resumes every interrupted branch of a parallel group.
   *
   * The set is computed once from the restart payload and each entry is
   * consumed on bypass. Judging by the live `stepResults` status instead would
   * wrongly bypass later loop iterations of a step that just ran.
   */
  const restartSeeded = new Set(
    Object.entries(params.restart?.stepResults ?? {})
      .filter(([id, result]) => {
        return id !== 'input' && (result as { status?: string } | null)?.status === 'success';
      })
      .map(([id]) => id),
  );

  /** Seeded output a bypassed step contributes to the data flow. */
  function seededOutput(stepId: string): unknown {
    const seeded = stepResults[stepId];
    return seeded && typeof seeded === 'object' ? (seeded as { output?: unknown }).output : undefined;
  }

  /** Step ids an entry can be time-travel targeted by; mirrors core's `getStepIds`. */
  function entryStepIds(entry: SerializedEntry): string[] {
    switch (entry.type) {
      case 'step':
      case 'loop':
      case 'foreach':
        return [entry.step.id];
      case 'parallel':
      case 'conditional':
        return entry.steps.map(branch => branch.step.id);
      case 'sleep':
      case 'sleepUntil':
        return [entry.id];
      default:
        return [];
    }
  }

  /**
   * Settles an entry before the time-travel target from its seeded results:
   * nothing executes, nothing is journaled or emitted; the entry contributes
   * only its historical output to the data flow, like the default engine
   * starting execution at the target's graph index.
   */
  function bypassEntry(entry: SerializedEntry, inputData: unknown, scope: WalkScope): unknown {
    switch (entry.type) {
      case 'step':
      case 'loop':
      case 'foreach':
        return seededOutput(qualifyId(scope, entry.step.id));
      case 'sleep':
      case 'sleepUntil':
        // Sleeps pass their input through.
        return seededOutput(qualifyId(scope, entry.id)) ?? inputData;
      case 'parallel': {
        const merged: Record<string, unknown> = {};
        for (const branch of entry.steps) {
          merged[branch.step.id] = seededOutput(qualifyId(scope, branch.step.id));
        }
        return merged;
      }
      case 'conditional': {
        // Only branches seeded successful contribute; unselected siblings are
        // seeded `skipped` and must stay out of the merged output.
        const merged: Record<string, unknown> = {};
        for (const branch of entry.steps) {
          const seeded = stepResults[qualifyId(scope, branch.step.id)] as
            | { status?: string; output?: unknown }
            | undefined;
          if (seeded?.status === 'success') {
            merged[branch.step.id] = seeded.output;
          }
        }
        return merged;
      }
      default:
        return inputData;
    }
  }
  const defaultAttempts = params.retryConfig?.attempts ?? 0;
  const retryDelay = params.retryConfig?.delay ?? 0;
  /**
   * How many times each token base has parked; see {@link suspendToken}. Lives
   * at run scope so a loop that re-runs a step keeps counting up. The walk is
   * deterministic, so replays rebuild identical counts.
   */
  const parkCounts: Record<string, number> = {};
  /**
   * Request-context entries carried across ops. Steps run host-side against a
   * fresh `RequestContext` per op, so mutations only survive because the host
   * echoes the entries back and they are re-sent with the next op.
   */
  let requestContextEntries: [string, unknown][] = params.requestContext ?? [];

  /**
   * perStep execution mode: a budget of steps the walk may still execute.
   * Starts at one; every executed step consumes one; exhausting it pauses the
   * walk on a hook until `resume()` grants one more. Without perStep the
   * budget is infinite and the gate is a no-op.
   */
  const perStep = params.perStep === true;
  let stepBudget = perStep ? 1 : Number.POSITIVE_INFINITY;
  let pauseSeq = 0;

  /**
   * Concurrent branches of the walk that are still making progress. Starts at
   * one for the main walk; concurrent groups (parallel entries, foreach
   * batches) transfer that activity to their branches while they run.
   *
   * A caller of `start()`/`resume()` must be handed back only once the run has
   * quiesced — with two parallel steps suspending, reporting after the first
   * park would hide the second suspension from the result. Every park and
   * every settling branch decrements this; whoever drives it to zero announces
   * the full set of parked steps via {@link flushIfQuiesced}.
   */
  let activeTasks = 1;
  /**
   * Steps currently parked on a hook. `order` is the step's graph position
   * (workflow path, entry path, foreach index): which branch parks first is a
   * race, so announcement order comes from the graph instead.
   */
  const pendingParks: {
    stepId: string;
    inputData: unknown;
    suspendPayload: unknown;
    token: string;
    order: number[];
    startedAt?: number;
    suspendedAt?: number;
  }[] = [];

  /**
   * Announces run-level suspension once nothing is running and at least one
   * step is parked. The `workflow-suspension-settled` event is internal: the
   * run observer settles on it (never on individual step suspensions), and
   * `stream()`/`watch()` filter it out.
   */
  async function flushIfQuiesced(): Promise<void> {
    if (activeTasks > 0 || pendingParks.length === 0) {
      return;
    }
    const ordered = [...pendingParks].sort((a, b) => {
      for (let i = 0; i < Math.max(a.order.length, b.order.length); i++) {
        const delta = (a.order[i] ?? -1) - (b.order[i] ?? -1);
        if (delta !== 0) {
          return delta;
        }
      }
      return 0;
    });
    await effects.emit([
      {
        type: 'workflow-suspension-settled',
        runId: params.runId,
        payload: {
          suspended: ordered.map(park => ({
            id: park.stepId,
            payload: park.inputData,
            suspendPayload: park.suspendPayload,
            resumeToken: park.token,
            startedAt: park.startedAt,
            suspendedAt: park.suspendedAt,
          })),
        },
      },
    ]);
  }

  /**
   * Runs branches concurrently while keeping {@link activeTasks} accurate:
   * the awaiting parent hands its slot to the branches, and each branch gives
   * its slot back the moment it settles — not when `Promise.all` resolves —
   * so a branch finishing while a sibling is parked can see the run quiesce.
   */
  async function runConcurrent<T>(tasks: (() => Promise<T>)[]): Promise<T[]> {
    // perStep runs branches one after another: concurrent branches would race
    // for the step budget, and which branch wins a race is not replay-stable.
    // Sequential execution keeps both the "one step at a time" semantics and
    // the journal deterministic.
    if (perStep) {
      const results: T[] = [];
      for (const task of tasks) {
        results.push(await task());
      }
      return results;
    }
    activeTasks += tasks.length - 1;
    try {
      return await Promise.all(
        tasks.map(async task => {
          let result: T;
          try {
            result = await task();
          } catch (error) {
            activeTasks -= 1;
            // Best-effort: the failure is about to finish the run anyway.
            await flushIfQuiesced().catch(() => {});
            throw error;
          }
          activeTasks -= 1;
          await flushIfQuiesced();
          return result;
        }),
      );
    } finally {
      activeTasks += 1;
    }
  }

  /**
   * perStep gate, run before a step executes. A no-op unless perStep is on.
   *
   * When the budget is spent: persist the pause (status `paused` plus the hook
   * token) via a `pause` op, then park on the hook. The `workflow-paused`
   * event is published from inside `awaitResume` — after the hook exists — so
   * an observer that reacts to it by resuming can never hit `HookNotFoundError`,
   * the same ordering contract suspensions use. Each hook resolution grants
   * exactly one more step.
   *
   * `consume` is false for nested-workflow wrappers: the walk must be able to
   * pause *before* entering one, but the wrapper itself executes no user code —
   * its inner steps each pay for themselves.
   */
  async function gatePerStep(consume: boolean): Promise<void> {
    if (!perStep) {
      return;
    }
    while (stepBudget <= 0) {
      const seq = pauseSeq;
      pauseSeq += 1;
      const token = pauseToken(params.runId, seq);

      const response = await effects.runOp({
        workflowId: params.workflowId,
        runId: params.runId,
        resourceId: params.resourceId,
        op: { kind: 'pause', pauseSeq: seq, pauseToken: token },
        inputData: undefined,
        state,
        initData,
        stepResults,
        requestContext: requestContextEntries,
      });
      const expected = `${PAUSE_IDENTITY_PREFIX}${seq}`;
      if (response.identity !== expected) {
        throw new Error(
          `Workflow replay diverged: expected "${expected}" at this pause, ` +
            `but the recorded result was for "${response.identity}".`,
        );
      }

      await effects.awaitResume(token, async () => {
        await effects.emit([
          {
            type: 'workflow-paused',
            runId: params.runId,
            payload: { pauseToken: token, state, steps: stepResults },
          },
        ]);
        activeTasks -= 1;
      });
      activeTasks += 1;
      stepBudget += 1;
    }
    if (consume) {
      stepBudget -= 1;
    }
  }

  /**
   * Runs one op once and folds any state mutation back into the run.
   *
   * `expectedId` guards replay. The Workflow SDK matches journal entries by
   * position and checks only the step function's name on replay, and every op
   * in this walk goes through the same `executeMastraOp` function — so that
   * check cannot distinguish two different graph nodes. Comparing the identity
   * the host echoed back against the node we are standing on restores the
   * guarantee: if a walk ever replays in a different order than it was
   * recorded, this throws instead of quietly handing one node's output to
   * another.
   */
  async function invoke(
    op: MastraOp,
    inputData: unknown,
    expectedId: string,
    scope: WalkScope,
    extra: Partial<MastraOpRequest> = {},
  ): Promise<MastraOpResponse> {
    const response = await effects.runOp({
      workflowId: params.workflowId,
      runId: params.runId,
      resourceId: params.resourceId,
      op,
      inputData,
      state,
      initData: scope.initData,
      stepResults,
      ...(scope.prefix ? { stepIdPrefix: scope.prefix } : {}),
      requestContext: requestContextEntries,
      ...(params.disableScorers === undefined ? {} : { disableScorers: params.disableScorers }),
      ...(params.tracingIds ? { tracingIds: params.tracingIds } : {}),
      ...(params.actor === undefined ? {} : { actor: params.actor }),
      ...extra,
    });

    // Must mirror the host's `opIdentity()` exactly.
    const opScope = op.workflowPath?.length ? `${op.workflowPath.map(p => p.join('.')).join('/')}/` : '';
    const expected = `${op.kind}@${opScope}${op.path.join('.')}#${expectedId}`;
    if (response.identity !== expected) {
      throw new Error(
        `Workflow replay diverged: expected "${expected}" at this point in the graph, ` +
          `but the recorded result was for "${response.identity}". The step graph ` +
          `changed between the original run and this replay, or the walk is not ` +
          `deterministic.`,
      );
    }

    // The host owns `setState()` during a step, so its copy wins afterwards.
    for (const key of Object.keys(state)) {
      delete state[key];
    }
    Object.assign(state, response.state ?? {});
    // Same for requestContext: the host echoes back the entries after the op
    // ran so step-written mutations survive into subsequent ops.
    if (response.requestContext) {
      requestContextEntries = response.requestContext;
    }
    return response;
  }

  /** Stamps the scope's workflowPath onto an op built for a node in that scope. */
  function scopedOp<T extends MastraOp>(op: T, scope: WalkScope): T {
    return scope.workflowPath.length ? { ...op, workflowPath: scope.workflowPath } : op;
  }

  /** Runs a non-step callable (condition, sleep resolver) and unwraps its value. */
  async function invokeValue(
    op: MastraOp,
    inputData: unknown,
    expectedId: string,
    scope: WalkScope,
    extra: Partial<MastraOpRequest> = {},
  ) {
    const response = await invoke(scopedOp(op, scope), inputData, expectedId, scope, extra);
    if (response.status === 'failed') {
      throw new StepFailureSignal(response.error);
    }
    if (response.status === 'suspended') {
      throw new Error(
        `A condition or resolver function suspended, which @mastra/workflow-sdk does not support. ` +
          `Only step \`execute\` functions may call suspend().`,
      );
    }
    return response.output;
  }

  /**
   * Runs one Mastra step to a terminal outcome.
   *
   * Two loops are layered here: an outer retry loop bounded by the step's
   * configured attempts, and an inner suspend loop that parks on a hook and
   * re-invokes the step with the resume payload until it stops suspending.
   *
   * Nested workflow steps take a different route entirely: their graph is
   * interpreted inline by {@link runNestedWorkflow} rather than dispatched to
   * the host as a single op.
   */
  async function runStep(
    step: SerializedStepLike,
    path: number[],
    inputData: unknown,
    scope: WalkScope,
    foreachIndex?: number,
  ): Promise<unknown> {
    // A step the source run completed settles from its seeded result: no ops,
    // no events, only its historical output feeding the data flow. Reached by
    // finished branches of partially completed groups and by inner steps of a
    // nested workflow that was interrupted midway.
    if (restartSeeded.delete(qualifyId(scope, step.id))) {
      return seededOutput(qualifyId(scope, step.id));
    }
    if (step.serializedStepFlow) {
      if (timeTravel && timeTravel.steps[0] === step.id) {
        // Descend toward a nested target — or, when the wrapper itself is the
        // target, leave time-travel mode and run the whole nested workflow.
        // Mirrors the default engine slicing `timeTravel.steps` per level.
        timeTravel = timeTravel.steps.length > 1 ? { ...timeTravel, steps: timeTravel.steps.slice(1) } : undefined;
      }
      // Gate but don't consume: the pause belongs before the wrapper's
      // step-start event, while the budget is spent by the steps inside.
      await gatePerStep(false);
      return runNestedWorkflow(step, path, inputData, scope);
    }

    let timeTravelResumeData: unknown;
    if (timeTravel && timeTravel.steps[0] === step.id) {
      // Target reached: hand the step its resume payload when it was suspended
      // in the source run, then leave time-travel mode for the rest of the walk.
      const seeded = stepResults[qualifyId(scope, step.id)] as { status?: string } | undefined;
      if (timeTravel.resumeData !== undefined && seeded?.status === 'suspended') {
        timeTravelResumeData = timeTravel.resumeData;
      }
      timeTravel = undefined;
    }

    await gatePerStep(true);

    const stepId = qualifyId(scope, step.id);
    const attempts = params.stepRetries?.[stepId] ?? defaultAttempts;
    const op: MastraOp = scopedOp({ kind: 'step', path }, scope);

    await effects.emit([
      {
        type: 'workflow-step-start',
        runId: params.runId,
        payload: { id: stepId, status: 'running', payload: inputData },
      },
    ]);

    let retryCount = 0;
    const parkKey = suspendToken(params.runId, stepId, foreachIndex);
    // Hoisted outside the retry loop so a failed resumed invocation retries
    // with the same payload instead of suspending again.
    let resumeData: unknown = timeTravelResumeData;
    for (;;) {
      let response = await invoke(op, inputData, step.id, scope, {
        retryCount,
        foreachIndex,
        suspendSeq: parkCounts[parkKey] ?? 0,
        ...(resumeData === undefined ? {} : { resumeData }),
      });

      // Suspend loop: park on a hook, then re-run the step with its payload.
      while (response.status === 'suspended') {
        const parkSeq = parkCounts[parkKey] ?? 0;
        parkCounts[parkKey] = parkSeq + 1;
        const token = suspendToken(params.runId, stepId, foreachIndex, parkSeq);
        const suspendedResponse = response;
        stepResults[stepId] = {
          status: 'suspended',
          payload: inputData,
          suspendPayload: response.suspendPayload,
          startedAt: response.startedAt,
          suspendedAt: response.suspendedAt,
        };

        const park = {
          stepId,
          inputData,
          suspendPayload: suspendedResponse.suspendPayload,
          token,
          order: [...scope.workflowPath.flat(), ...path, foreachIndex ?? -1],
          startedAt: suspendedResponse.startedAt,
          suspendedAt: suspendedResponse.suspendedAt,
        };

        // The suspended event is published from inside `awaitResume`, after the
        // hook exists. Announcing the suspension first would invite a caller to
        // resume a token that is not registered yet. The park is recorded in
        // the same callback: by the time the aggregate settle event lists this
        // step, its hook is resumable.
        resumeData = await effects.awaitResume(token, async () => {
          await effects.emit([
            {
              type: 'workflow-step-suspended',
              runId: params.runId,
              payload: {
                id: stepId,
                status: 'suspended',
                payload: inputData,
                suspendPayload: suspendedResponse.suspendPayload,
                resumeToken: token,
                startedAt: suspendedResponse.startedAt,
                suspendedAt: suspendedResponse.suspendedAt,
              },
            },
          ]);
          activeTasks -= 1;
          pendingParks.push(park);
          await flushIfQuiesced();
        });
        activeTasks += 1;
        const parkIndex = pendingParks.indexOf(park);
        if (parkIndex !== -1) {
          pendingParks.splice(parkIndex, 1);
        }
        response = await invoke(op, inputData, step.id, scope, {
          retryCount,
          foreachIndex,
          resumeData,
          suspendSeq: parkCounts[parkKey] ?? 0,
        });
      }

      if (response.status === 'failed') {
        const canRetry = retryCount < attempts && !response.error.nonRetryable;
        if (canRetry) {
          retryCount += 1;
          if (retryDelay > 0) {
            await effects.sleepMs(retryDelay);
          }
          continue;
        }
        stepResults[stepId] = {
          status: 'failed',
          error: response.error,
          payload: inputData,
          startedAt: response.startedAt,
          endedAt: response.endedAt,
        };
        await effects.emit([
          {
            type: 'workflow-step-result',
            runId: params.runId,
            payload: { id: stepId, status: 'failed', error: response.error },
          },
        ]);
        throw new StepFailureSignal(response.error);
      }

      stepResults[stepId] = {
        status: 'success',
        output: response.output,
        payload: inputData,
        ...(resumeData === undefined ? {} : { resumePayload: resumeData }),
        startedAt: response.startedAt,
        endedAt: response.endedAt,
      };
      await effects.emit([
        {
          type: 'workflow-step-result',
          runId: params.runId,
          payload: { id: stepId, status: 'success', output: response.output },
        },
        { type: 'workflow-step-finish', runId: params.runId, payload: { id: stepId, metadata: {} } },
      ]);

      if (response.status === 'bailed') {
        throw new BailSignal(response.output);
      }
      if (response.status === 'success' && response.aborted) {
        throw new AbortRunSignal();
      }
      return response.output;
    }
  }

  /**
   * Interprets a nested workflow step inline, inside the same SDK run/journal.
   *
   * The nested `serializedStepFlow` is walked with a child scope: ops carry the
   * wrapper's path in `workflowPath` (so the host resolves callables out of the
   * nested graph and identities cannot collide with top-level nodes), and step
   * ids gain the wrapper's dotted prefix (so events, results and suspend
   * tokens are unambiguous). Results land in the same flat `stepResults` map;
   * the wrapper step itself settles like a plain step, with the nested
   * workflow's final output as its output.
   */
  async function runNestedWorkflow(
    step: SerializedStepLike,
    path: number[],
    inputData: unknown,
    scope: WalkScope,
  ): Promise<unknown> {
    const stepId = qualifyId(scope, step.id);
    const startedAt = Date.now();

    await effects.emit([
      {
        type: 'workflow-step-start',
        runId: params.runId,
        payload: { id: stepId, status: 'running', payload: inputData },
      },
    ]);

    const childScope: WalkScope = {
      workflowPath: [...scope.workflowPath, path],
      prefix: stepId,
      initData: inputData,
    };
    const nestedGraph = step.serializedStepFlow as SerializedEntry[];

    const settle = async (output: unknown): Promise<unknown> => {
      stepResults[stepId] = {
        status: 'success',
        output,
        payload: inputData,
        startedAt,
        endedAt: Date.now(),
      };
      await effects.emit([
        {
          type: 'workflow-step-result',
          runId: params.runId,
          payload: { id: stepId, status: 'success', output },
        },
        { type: 'workflow-step-finish', runId: params.runId, payload: { id: stepId, metadata: {} } },
      ]);
      return output;
    };

    try {
      let current: unknown = inputData;
      for (let index = 0; index < nestedGraph.length; index++) {
        current = await runEntry(nestedGraph[index]!, [index], current, childScope);
      }
      return await settle(current);
    } catch (error) {
      // `bail()` inside a nested workflow finishes only that workflow: its
      // bailed value becomes the wrapper step's output and the parent walks on.
      if (error instanceof BailSignal) {
        return await settle(error.output);
      }
      if (error instanceof StepFailureSignal) {
        stepResults[stepId] = {
          status: 'failed',
          error: error.error,
          payload: inputData,
          startedAt,
          endedAt: Date.now(),
        };
        await effects.emit([
          {
            type: 'workflow-step-result',
            runId: params.runId,
            payload: { id: stepId, status: 'failed', error: error.error },
          },
        ]);
      }
      throw error;
    }
  }

  /**
   * Durable sleep bracketed with the default engine's waiting lifecycle:
   * a `workflow-step-waiting` event and a `waiting` step result while parked,
   * then a passthrough success result once the delay elapses.
   */
  async function runSleep(id: string, ms: number, inputData: unknown, scope: WalkScope): Promise<unknown> {
    const stepId = qualifyId(scope, id);
    const startedAt = Date.now();
    stepResults[stepId] = { status: 'waiting', payload: inputData, startedAt };
    await effects.emit([
      {
        type: 'workflow-step-waiting',
        runId: params.runId,
        payload: { id: stepId, payload: inputData, startedAt, status: 'waiting' },
      },
    ]);

    await effects.sleepMs(ms);

    const endedAt = Date.now();
    stepResults[stepId] = { status: 'success', payload: inputData, output: inputData, startedAt, endedAt };
    await effects.emit([
      {
        type: 'workflow-step-result',
        runId: params.runId,
        payload: { id: stepId, status: 'success', output: inputData, endedAt },
      },
      {
        type: 'workflow-step-finish',
        runId: params.runId,
        payload: { id: stepId, metadata: {} },
      },
    ]);
    return inputData;
  }

  async function runEntry(
    entry: SerializedEntry,
    path: number[],
    inputData: unknown,
    scope: WalkScope,
  ): Promise<unknown> {
    if (timeTravel) {
      const targetId = timeTravel.steps[0]!;
      if (!entryStepIds(entry).includes(targetId)) {
        return bypassEntry(entry, inputData, scope);
      }
      // The target lives in this entry. Group entries execute only the target
      // branch — siblings keep their seeded results — mirroring the default
      // engine's per-branch `timeTravel.steps[0] === step.id` check.
      if (entry.type === 'parallel') {
        const branchIndex = entry.steps.findIndex(branch => branch.step.id === targetId);
        const output = await runStep(entry.steps[branchIndex]!.step, [...path, branchIndex], inputData, scope);
        const merged: Record<string, unknown> = {};
        for (const branch of entry.steps) {
          merged[branch.step.id] =
            branch.step.id === targetId ? output : seededOutput(qualifyId(scope, branch.step.id));
        }
        return merged;
      }
      if (entry.type === 'conditional') {
        // Conditions are bypassed entirely: targeting a branch step selects it.
        const branchIndex = entry.steps.findIndex(branch => branch.step.id === targetId);
        const output = await runStep(entry.steps[branchIndex]!.step, [...path, branchIndex], inputData, scope);
        return { [targetId]: output };
      }
      if (entry.type !== 'step') {
        // Loop, foreach and sleep targets re-run their whole entry from here.
        timeTravel = undefined;
      }
      // Plain steps (and nested wrappers) clear time travel inside `runStep`.
    }
    if (restartSeeded.size > 0) {
      // An entry the source run fully completed settles wholesale from its
      // seeded results — including loop and foreach entries, whose iterations
      // must not re-run one by one against a seeded final output. Unselected
      // conditional siblings are seeded `skipped` and count as settled too.
      // Partially completed groups fall through; their finished branches
      // bypass individually inside `runStep`.
      const ids = entryStepIds(entry).map(id => qualifyId(scope, id));
      const settled = (id: string) =>
        restartSeeded.has(id) || (stepResults[id] as { status?: string } | undefined)?.status === 'skipped';
      if (ids.length > 0 && ids.every(settled) && ids.some(id => restartSeeded.has(id))) {
        for (const id of ids) {
          restartSeeded.delete(id);
        }
        return bypassEntry(entry, inputData, scope);
      }
    }
    switch (entry.type) {
      case 'step':
        return runStep(entry.step, path, inputData, scope);

      case 'sleep': {
        const ms =
          entry.duration ??
          (entry.fn ? Number(await invokeValue({ kind: 'sleep-duration', path }, inputData, entry.id, scope)) : 0);
        return runSleep(entry.id, Number.isFinite(ms) ? Math.max(0, ms) : 0, inputData, scope);
      }

      case 'sleepUntil': {
        let target: number;
        if (entry.date != null) {
          target = new Date(entry.date as string).getTime();
        } else if (entry.fn) {
          target = new Date(
            (await invokeValue({ kind: 'sleep-until-date', path }, inputData, entry.id, scope)) as string | number,
          ).getTime();
        } else {
          target = Date.now();
        }
        // `Date.now()` inside the sandbox is replay-stable, so the computed
        // delay is identical on every replay of this entry.
        const ms = Number.isFinite(target) ? Math.max(0, target - Date.now()) : 0;
        return runSleep(entry.id, ms, inputData, scope);
      }

      case 'parallel': {
        const outputs = await runConcurrent(
          entry.steps.map(
            (branch, branchIndex) => () => runStep(branch.step, [...path, branchIndex], inputData, scope),
          ),
        );
        const merged: Record<string, unknown> = {};
        entry.steps.forEach((branch, branchIndex) => {
          merged[branch.step.id] = outputs[branchIndex];
        });
        return merged;
      }

      case 'conditional': {
        const truthy = await Promise.all(
          entry.serializedConditions.map((_condition, conditionIndex) =>
            invokeValue({ kind: 'condition', path, conditionIndex }, inputData, `condition_${conditionIndex}`, scope),
          ),
        );
        // Truthy branches run concurrently, like the default engine: two
        // branches suspending must both park before the run settles, which
        // sequential execution would never reach.
        const truthyIndices = entry.steps
          .map((_, branchIndex) => branchIndex)
          .filter(branchIndex => truthy[branchIndex]);
        const outputs = await runConcurrent(
          truthyIndices.map(
            branchIndex => () => runStep(entry.steps[branchIndex]!.step, [...path, branchIndex], inputData, scope),
          ),
        );
        const merged: Record<string, unknown> = {};
        truthyIndices.forEach((branchIndex, position) => {
          merged[entry.steps[branchIndex]!.step.id] = outputs[position];
        });
        return merged;
      }

      case 'loop': {
        let carried = inputData;
        let iterationCount = 0;
        for (;;) {
          carried = await runStep(entry.step, path, carried, scope);
          const keepGoing = Boolean(
            await invokeValue({ kind: 'loop-condition', path }, carried, `${entry.step.id}_condition`, scope, {
              iterationCount,
            }),
          );
          iterationCount += 1;
          // `dowhile` runs while the condition holds; `dountil` runs until it does.
          if (entry.loopType === 'dowhile' ? !keepGoing : keepGoing) {
            return carried;
          }
        }
      }

      case 'foreach': {
        const items = Array.isArray(inputData) ? inputData : [];
        let concurrency = entry.opts?.concurrency ?? 1;
        if (entry.opts?.fn) {
          concurrency = Number(
            await invokeValue({ kind: 'foreach-concurrency', path }, inputData, `${entry.step.id}_concurrency`, scope),
          );
        }
        const width = Number.isFinite(concurrency) ? Math.max(1, Math.floor(concurrency)) : 1;

        // Fixed-size batches rather than a worker pool: which element each
        // invocation handles must not depend on how fast its neighbours
        // resolve, or a replay could pair an element with a different journal
        // entry than the original run did.
        const foreachId = qualifyId(scope, entry.step.id);
        const foreachStartedAt = Date.now();
        const outputs: unknown[] = [];
        let completedCount = 0;
        for (let offset = 0; offset < items.length; offset += width) {
          const batch = items.slice(offset, offset + width);
          // Fold each iteration's outcome instead of letting it throw, so the
          // whole batch settles and progress can be announced in index order —
          // settle order inside a batch is a race.
          const settled = await runConcurrent(
            batch.map(
              (item, withinBatch) => () =>
                runStep(entry.step, path, item, scope, offset + withinBatch).then(
                  value => ({ ok: true as const, value }),
                  error => ({ ok: false as const, error }),
                ),
            ),
          );
          for (let withinBatch = 0; withinBatch < settled.length; withinBatch++) {
            const outcome = settled[withinBatch]!;
            const currentIndex = offset + withinBatch;
            if (outcome.ok) {
              completedCount += 1;
              await effects.emit([
                {
                  type: 'workflow-step-progress',
                  runId: params.runId,
                  payload: {
                    id: foreachId,
                    completedCount,
                    totalCount: items.length,
                    currentIndex,
                    iterationStatus: 'success',
                    ...(outcome.value !== undefined ? { iterationOutput: outcome.value } : {}),
                  },
                },
              ]);
              outputs.push(outcome.value);
            } else {
              if (outcome.error instanceof StepFailureSignal) {
                await effects.emit([
                  {
                    type: 'workflow-step-progress',
                    runId: params.runId,
                    payload: {
                      id: foreachId,
                      completedCount,
                      totalCount: items.length,
                      currentIndex,
                      iterationStatus: 'failed',
                    },
                  },
                ]);
              }
              throw outcome.error;
            }
          }
        }
        stepResults[foreachId] = {
          status: 'success',
          output: outputs,
          payload: inputData,
          startedAt: foreachStartedAt,
          endedAt: Date.now(),
        };
        return outputs;
      }

      default: {
        const unknownEntry = entry as { type?: string };
        throw unsupported(`Step graph entry of type "${unknownEntry.type}"`);
      }
    }
  }

  await effects.emit([{ type: 'workflow-start', runId: params.runId, payload: { runId: params.runId } }]);

  const rootScope: WalkScope = { workflowPath: [], prefix: '', initData };

  let finish: MastraRunnerResult;
  try {
    let current: unknown = params.inputData;
    for (let index = 0; index < graph.length; index++) {
      current = await runEntry(graph[index]!, [index], current, rootScope);
    }
    // The default engine pauses *after* every executed entry — including the
    // last one — so a perStep walk that spent its budget on the final step
    // must park once more here; the resume that follows finds nothing left to
    // run and settles the run as successful.
    if (stepBudget <= 0) {
      await gatePerStep(false);
    }
    finish = {
      status: 'success',
      result: current,
      state,
      steps: stepResults,
      input: params.inputData,
    };
  } catch (error) {
    if (error instanceof BailSignal) {
      finish = {
        status: 'success',
        result: error.output,
        state,
        steps: stepResults,
        input: params.inputData,
      };
    } else if (error instanceof AbortRunSignal) {
      finish = {
        status: 'canceled',
        state,
        steps: stepResults,
        input: params.inputData,
      };
    } else if (error instanceof StepFailureSignal) {
      finish = {
        status: 'failed',
        error: error.error,
        state,
        steps: stepResults,
        input: params.inputData,
      };
    } else {
      finish = {
        status: 'failed',
        error: toSerializedError(error),
        state,
        steps: stepResults,
        input: params.inputData,
      };
    }
  }

  // Record the terminal state in storage before announcing the finish, so a
  // client that reads storage the moment it sees `workflow-finish` sees the
  // settled run rather than the last `running` write a step left behind.
  //
  // Storage mirroring is best-effort — the event log is the source of truth for
  // execution — so a failure here must not turn a finished run into a failed
  // one. `persistSnapshot()` already swallows its own errors; this catch covers
  // the step invocation around it. A journal divergence is a different class of
  // fault, so the identity check happens outside the try and does throw.
  let finalizeResponse: MastraOpResponse | undefined;
  try {
    finalizeResponse = await effects.runOp({
      workflowId: params.workflowId,
      runId: params.runId,
      resourceId: params.resourceId,
      op:
        finish.status === 'failed'
          ? { kind: 'finalize', status: 'failed', error: finish.error }
          : finish.status === 'canceled'
            ? { kind: 'finalize', status: 'canceled' }
            : { kind: 'finalize', status: 'success', result: finish.result },
      inputData: undefined,
      state,
      initData,
      stepResults,
      requestContext: requestContextEntries,
      ...(params.tracingIds ? { tracingIds: params.tracingIds } : {}),
      ...(params.workflowSpanData ? { workflowSpanData: params.workflowSpanData } : {}),
    });
  } catch {
    // Left to the event log; see above.
  }
  if (finalizeResponse && finalizeResponse.identity !== FINALIZE_IDENTITY) {
    throw new Error(
      `Workflow replay diverged: expected "${FINALIZE_IDENTITY}" at the end of the walk, ` +
        `but the recorded result was for "${finalizeResponse.identity}".`,
    );
  }

  // `state` and `steps` ride along so a client watching the stream can build a
  // complete Mastra `WorkflowResult` without a second read of storage.
  await effects.emit([
    {
      type: 'workflow-finish',
      runId: params.runId,
      payload: {
        status: finish.status,
        result: finish.result,
        error: finish.error,
        state: finish.state,
        steps: finish.steps,
      },
    },
  ]);

  return finish;
}
