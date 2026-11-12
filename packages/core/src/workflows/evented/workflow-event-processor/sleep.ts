import type { StepFlowEntry, WorkflowRunState } from '../..';
import { RequestContext } from '../../../di';
import type { PubSub } from '../../../events';
import type { IMastraLogger } from '../../../logger';
import type { WorkflowsStorage } from '../../../storage/domains/workflows';
import { WORKFLOW_RUN_LEASE_TTL_MS } from '../../run-ownership';
import { withoutAuthToken } from '../helpers';
import {
  claimSleepStart,
  claimSleepWake,
  markRunAsleep,
  markRunLive,
  sleepOccurrenceKey,
  sleepStartKey,
  storedWakeAt,
} from '../leases';
import type { LivenessScope, SleepWakeLease } from '../leases';
import type { StepExecutor } from '../step-executor';
import { DeferredDelivery } from './deferred-delivery';
import { getStepId } from './utils';
import type { ProcessorArgs } from '.';

export async function processWorkflowWaitForEvent(
  workflowData: ProcessorArgs,
  {
    pubsub,
    eventName,
    currentState,
  }: {
    pubsub: PubSub;
    eventName: string;
    currentState: WorkflowRunState;
  },
) {
  const executionPath = currentState?.waitingPaths[eventName];
  if (!executionPath) {
    return;
  }

  const currentStepId = getStepId(workflowData.workflow, executionPath);
  const prevResult = {
    status: 'success',
    output: currentState?.context[currentStepId ?? 'input']?.payload,
  };

  await pubsub.publish('workflows', {
    type: 'workflow.step.run',
    runId: workflowData.runId,
    data: {
      workflowId: workflowData.workflowId,
      runId: workflowData.runId,
      executionPath,
      resumeSteps: [],
      resumeData: workflowData.resumeData,
      parentWorkflow: workflowData.parentWorkflow,
      stepResults: currentState?.context,
      prevResult,
      activeStepsPath: {},
      requestContext: withoutAuthToken(currentState?.requestContext),
      // Known gap (deliberately deferred — PR #24569 review, Superagent P2):
      // the actor signal is not persisted in the workflow snapshot, so a run
      // continued from a waitForEvent only keeps the actor if the resuming
      // event carried one. requestContext survives via the snapshot; actor
      // does not. Consequence: an FGA-gated tool with `requireActor` fails
      // closed after the wait even though the originating caller was
      // authorized, and permissive paths run unattributed. Intended fix:
      // persist the ActorSignal (a plain identity claim, no secret material)
      // in the snapshot alongside requestContext and restore it here with an
      // event-carried actor taking precedence: `workflowData.actor ?? snapshot`.
      actor: workflowData.actor,
      perStep: workflowData.perStep,
    },
  });
}

/** What the sleep handlers need from the event processor running them. */
interface SleepDeps {
  pubsub: PubSub;
  stepExecutor: StepExecutor;
  workflowsStore?: WorkflowsStorage;
  /** The store holding the run's step leases; `undefined` when the run's steps run unleased. */
  leaseStore?: WorkflowsStorage;
  /**
   * The run and its ancestors that take leases, each with its store: the runs
   * whose wake key a sleep sets and whose liveness its wake marks.
   */
  wakeRuns: { runId: string; store: WorkflowsStorage }[];
  /** The process running the sleep. */
  scope: LivenessScope;
  logger?: IMastraLogger;
}

/** One sleep occurrence as its `waiting` result stores it. Times are epoch milliseconds. */
interface SleepOccurrence {
  /** The id the result is stored under, which can differ from the sleep's id in this process. */
  stepId: string;
  /** The sleep's input, which it passes on to the next step. */
  payload: unknown;
  startedAt: number;
  wakeAt: number;
}

type SleepEntry = Extract<StepFlowEntry, { type: 'sleep' | 'sleepUntil' }>;

/**
 * Resolves a sleep's duration in milliseconds. `state` is what the duration
 * function's `setState()` changes; `input` is the sleep's input.
 */
type ResolveDuration = (requestContext: RequestContext, state: Record<string, any>, input: unknown) => Promise<number>;

/** A wake this process set a timer for, or put aside while its workers are stopped. */
interface PendingWake {
  args: ProcessorArgs;
  deps: SleepDeps;
  occurrence: SleepOccurrence;
  /** How many attempts of this wake failed a lease check (see {@link retryWake}). */
  attempt: number;
  /** When the next attempt may run at the earliest, in epoch milliseconds. */
  notBefore: number;
  timer?: ReturnType<typeof setTimeout>;
}

// The longest wait between attempts of a wake whose lease checks keep failing.
const MAX_WAKE_RETRY_DELAY_MS = 5 * 60_000;

// How long an interrupted wake waits for the lease it let lapse (a millisecond lease) to run out.
const LAPSED_LEASE_MARGIN_MS = 10;

/** The pending wakes of the sleeps each process started or resumed. */
const pendingWakes = new WeakMap<LivenessScope, Set<PendingWake>>();
/** The wakes each process put aside when its workers stopped, set again when they start. */
const pausedWakes = new WeakMap<LivenessScope, PendingWake[]>();
/** The processes whose workers stopped, from {@link pauseSleepWakes} until {@link resumeSleepWakes}. */
const pausedScopes = new WeakSet<LivenessScope>();
/** A wake that holds its lease, and whether stopping the workers interrupted it. */
interface ActiveWake {
  lease: SleepWakeLease;
  /**
   * Set by {@link pauseSleepWakes} and never cleared: the workers starting again before the wake
   * noticed must not make it look lost to another process, which would drop it.
   */
  interrupted: boolean;
}

/** The wakes each process is running. */
const activeWakes = new WeakMap<LivenessScope, Set<ActiveWake>>();

// Longer timer delays overflow and fire at once, so a longer sleep is timed in chunks of this.
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;

const FINISHED_RUN_STATUSES = new Set(['success', 'failed', 'canceled', 'tripwire', 'bailed']);

/** Whether `a` is the same execution path as `b`; `undefined` and anything that isn't an array never is. */
const samePath = (a: number[] | undefined, b: number[]) =>
  Array.isArray(a) && a.length === b.length && a.every((index, i) => index === b[i]);

/**
 * Whether the stored run's cursor is past the sleep at `executionPath`: a step
 * after the sleep started. Sleeps are entries of their run's own step graph,
 * so their path has one index.
 */
const movedPastSleep = (snapshot: WorkflowRunState, executionPath: number[]) =>
  (snapshot.activePaths?.[0] ?? -1) > executionPath[0]!;

/**
 * Stops the wakes of the sleeps `scope` started or resumed. Called when its
 * workers stop, before their consumers go, since an event published from then
 * on might reach no worker.
 *
 * Pending wake timers are cleared and kept for {@link resumeSleepWakes}. A
 * wake already running stops renewing its lease and stops before it writes or
 * publishes, unless it already published; once stopped, it lets its lease
 * lapse and is kept the same way. A sleep that work the drain gave up on sets
 * up later is kept too. The sleeps stay `waiting`: the workers starting again
 * wake them, and so does another instance's recovery once their wake time and
 * the recovery grace period (`recovery.workflowGraceMs`) passed.
 */
export function pauseSleepWakes(scope: LivenessScope): void {
  pausedScopes.add(scope);

  const pending = [...(pendingWakes.get(scope) ?? [])];
  pendingWakes.delete(scope);
  pending.forEach(wake => clearTimeout(wake.timer));
  if (pending.length > 0) {
    pausedWakes.set(scope, [...(pausedWakes.get(scope) ?? []), ...pending]);
  }

  activeWakes.get(scope)?.forEach(wake => {
    wake.interrupted = true;
    wake.lease.abandon();
  });
}

/**
 * Sets the timers {@link pauseSleepWakes} cleared again, once the workers of
 * `scope` started again. Each fires at its sleep's wake time, or at once when
 * that passed.
 */
export function resumeSleepWakes(scope: LivenessScope): void {
  pausedScopes.delete(scope);

  const paused = pausedWakes.get(scope) ?? [];
  pausedWakes.delete(scope);
  paused.forEach(wake => scheduleWake(wake.args, wake.deps, wake.occurrence, wake));
}

/** Starts a `sleep` step, or resumes it when the run is already in it. See {@link startSleep}. */
export async function processWorkflowSleep(
  args: ProcessorArgs,
  deps: SleepDeps & { step: Extract<StepFlowEntry, { type: 'sleep' }> },
) {
  return startSleep(args, deps, (requestContext, state, input) =>
    deps.stepExecutor.resolveSleep({
      workflowId: args.workflowId,
      step: deps.step,
      runId: args.runId,
      stepResults: args.stepResults,
      state,
      requestContext,
      input,
      resumeData: args.resumeData,
      actor: args.actor,
    }),
  );
}

/** Starts a `sleepUntil` step, or resumes it when the run is already in it. See {@link startSleep}. */
export async function processWorkflowSleepUntil(
  args: ProcessorArgs,
  deps: SleepDeps & { step: Extract<StepFlowEntry, { type: 'sleepUntil' }> },
) {
  return startSleep(args, deps, (requestContext, state, input) =>
    deps.stepExecutor.resolveSleepUntil({
      workflowId: args.workflowId,
      step: deps.step,
      runId: args.runId,
      stepResults: args.stepResults,
      state,
      requestContext,
      input,
      resumeData: args.resumeData,
      actor: args.actor,
    }),
  );
}

/**
 * Records the sleep as `waiting` with its wake time in `metadata.wakeAt`, and
 * sets a timer that wakes the run then (see {@link wakeSleep}).
 *
 * When the stored run is already in this sleep (a restart, or a redelivery of
 * the sleep's event), the stored wake time is kept and only the remaining wait
 * is timed, so the sleep is not replayed from the start and a wake time that
 * passed wakes the run at once. A sleep stored without a wake time starts
 * over, under the id and with the input it was stored with. Time travel always
 * starts the sleep afresh. `resolveDuration` runs only for a sleep that is not
 * resumed. Every sleep then sets the wake key of its run and of the runs it is
 * nested in (see `markRunAsleep`).
 *
 * A delivery that arrives after the run left the sleep (it finished, moved
 * past the sleep, or the sleep was woken and the next step is on its way) is
 * dropped; see {@link leftSleep} for what counts under time travel. One that
 * finds the occurrence it read already woken only marks it finished.
 *
 * With step leases, deliveries of the sleep's event set it up one at a time
 * (see `claimSleepStart`): one that finds another delivery doing so waits for
 * it, and the stored run is read only once the lease is held.
 */
async function startSleep(
  args: ProcessorArgs,
  deps: SleepDeps & { step: SleepEntry },
  resolveDuration: ResolveDuration,
) {
  const { workflowId, runId, executionPath } = args;
  const start = deps.leaseStore
    ? await claimSleepStart({
        scope: deps.scope,
        store: deps.leaseStore,
        key: sleepStartKey(runId, executionPath),
        logger: deps.logger,
      })
    : undefined;
  // Another delivery held the lease and set the occurrence up.
  if (start === 'drop') {
    deps.logger?.debug('Dropping a delivery of a sleep another delivery set up', { workflowId, runId, executionPath });
    return;
  }

  if (start === 'defer') {
    throw new DeferredDelivery();
  }

  try {
    await setUpSleep(args, deps, resolveDuration, start);
  } finally {
    await start?.release();
  }
}

/**
 * The part of {@link startSleep} that runs under the sleep's start lease,
 * `start`; `undefined` when the run's steps run unleased.
 */
async function setUpSleep(
  args: ProcessorArgs,
  deps: SleepDeps & { step: SleepEntry },
  resolveDuration: ResolveDuration,
  start: SleepWakeLease | undefined,
) {
  const { workflow, workflowId, runId, executionPath, activeStepsPath, prevResult, requestContext, timeTravel } = args;
  const { pubsub, workflowsStore, leaseStore, step } = deps;
  // Step-lifecycle watch events honor `emitStepEvents: false` (#21529). The
  // `workflows` routing publish in wakeSleep is never gated: it drives execution.
  const emitStepEvents = workflow.options.emitStepEvents !== false;

  const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflowId, runId });
  const stored = snapshot && !timeTravel ? sleepInProgress(snapshot, executionPath, step.id) : undefined;
  // A sleep stored without its wake time can't tell how long is left, so it starts over.
  const resumed = stored?.wakeAt === undefined ? undefined : { ...stored, wakeAt: stored.wakeAt };
  // Once the next step moved the run on, only the delivery's own copy of the run shows the sleep.
  const delivered = timeTravel
    ? undefined
    : (stored ??
      sleepInProgress(
        { context: args.stepResults, activeStepsPath: args.activeStepsPath } as WorkflowRunState,
        executionPath,
        step.id,
      ));

  // Checked before whether the run left the sleep: a restart or a redelivery that read the run
  // before the wake can write the sleep back as `waiting`, also after the next step moved the run
  // on. Setting it up again would put the run back at the sleep, so only its result is fixed.
  if (delivered && leaseStore) {
    const wake = await leaseStore.getRunOwnership({
      runId: sleepOccurrenceKey(runId, executionPath, delivered.startedAt),
    });
    // Released, the wake lease marks the occurrence woken.
    if (wake && !wake.leaseExpiresAt) {
      deps.logger?.debug('Dropping a delivery of a sleep that was already woken', { workflowId, runId, executionPath });
      return markWokenSleepFinished(args, deps, delivered);
    }
  }

  // A time-travelled run whose `running` snapshots are left out stored nothing yet: the stored
  // run is still the one it travels from, so it cannot show this run past the sleep.
  const storesProgress =
    !timeTravel ||
    (workflow.options.shouldPersistSnapshot?.({ stepResults: args.stepResults ?? {}, workflowStatus: 'running' }) ??
      true);
  if (snapshot && storesProgress && leftSleep(snapshot, executionPath, !!timeTravel)) {
    deps.logger?.debug('Dropping a delivery of a sleep the workflow run already left', {
      workflowId,
      runId,
      executionPath,
    });
    return;
  }

  // A stored sleep keeps the id and input it was stored with; a resumed one its start time too.
  const stepId = stored?.stepId ?? step.id;
  const payload = stored ? stored.payload : prevResult.status === 'success' ? prevResult.output : undefined;
  const startedAt = resumed?.startedAt ?? Date.now();

  if (emitStepEvents) {
    await pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: {
        type: 'workflow-step-waiting',
        payload: { id: stepId, status: 'waiting', payload, startedAt },
      },
    });
  }

  // Only a fresh sleep resolves its duration: a resumed one waits for the rest of the stored wait.
  let wakeAt = resumed?.wakeAt;
  // The state a duration function changed with `setState()`, stored with the sleep: a resumed sleep
  // doesn't call the function again, so the next step would otherwise get the state from before it.
  let changedState: Record<string, any> | undefined;
  if (wakeAt === undefined) {
    // `setState()` assigns into the state object in place, which the proxy notices without
    // comparing serialized copies: run state may hold values JSON can't, such as a bigint.
    const state = (args.stepResults?.__state ?? {}) as Record<string, any>;
    let stateChanged = false;
    const tracked = new Proxy(state, {
      set(target, key, value, receiver) {
        stateChanged = true;
        return Reflect.set(target, key, value, receiver);
      },
      deleteProperty(target, key) {
        stateChanged = true;
        return Reflect.deleteProperty(target, key);
      },
    });
    // Create a proper RequestContext from the plain object passed in ProcessorArgs
    // `payload` is the stored input of a sleep stored without its wake time, which this process's
    // copy of the run may not carry under the id it gives the sleep.
    const duration = await resolveDuration(
      new RequestContext(Object.entries(requestContext ?? {}) as any),
      tracked,
      payload,
    );
    wakeAt = Date.now() + (Number.isFinite(duration) ? Math.max(0, duration) : 0);
    // Only a change is written: a parallel branch may have stored newer state than this delivery's copy.
    if (stateChanged) {
      changedState = state;
      // The wake passes the step results on; a run without state yet gets this new object.
      if (args.stepResults && !args.stepResults.__state) {
        (args.stepResults as Record<string, unknown>).__state = state;
      }
    }

    // The duration function can run for long. A start lease that lapsed meanwhile, its renewals
    // failing, may have let another delivery set this sleep up, and writing now could put the run
    // back at a sleep that already woke. Leases are advisory: a setup stalled after this check
    // can still write.
    const held = start ? await start.check() : 'held';
    if (held === 'lost') {
      deps.logger?.debug('Dropping a sleep setup whose start lease another delivery took', {
        workflowId,
        runId,
        executionPath,
      });
      return;
    }

    // A check the store failed tells nothing: the delivery fails, and the broker delivers it again.
    if (held === 'unknown') {
      throw new Error('Failed to check the start lease of a workflow sleep');
    }

    // A cancel that finished while the duration function ran must not be undone by setting the
    // run `running` again. Only a change counts: a time-travelled run whose `running` snapshots
    // are left out still shows the status of the run it travels from.
    const current = snapshot
      ? await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflowId, runId })
      : undefined;
    if (current && FINISHED_RUN_STATUSES.has(current.status) && current.status !== snapshot?.status) {
      deps.logger?.debug('Dropping a sleep setup of a run that ended while its duration resolved', {
        workflowId,
        runId,
        executionPath,
        status: current.status,
      });
      return;
    }
  }

  await workflowsStore?.updateWorkflowResults({
    workflowName: workflowId,
    runId,
    stepId,
    // The path goes with the wake time: the run's own write of its path at the sleep comes after
    // this one, and a process that stops in between leaves only this one (see sleepInProgress).
    result: { status: 'waiting', payload, startedAt, metadata: { wakeAt, path: executionPath } },
    requestContext: withoutAuthToken(requestContext ?? {}),
    state: changedState,
  });
  await workflowsStore?.updateWorkflowState({
    workflowName: workflowId,
    runId,
    opts: {
      status: 'running',
      activePaths: executionPath,
      activeStepsPath: { ...activeStepsPath, [stepId]: executionPath },
      // A cancel landing after the check above still wins on stores that compare and set. A wake
      // then finds the run canceled and stays put.
      ...(snapshot ? { expectedStatus: snapshot.status } : {}),
    },
  });

  // The run handles no event until the wake, so its liveness lapses; the wake key keeps recovery
  // away from it and its ancestors until then. Written after the run is stored at the sleep: a
  // process that stops in between leaves a run that a restart resumes here.
  await markRunAsleep({ runs: deps.wakeRuns, wakeAt, logger: deps.logger });

  // A restart derives the input from the sleep's id in this process, which may not be the stored one.
  const wakeArgs: ProcessorArgs = stored
    ? { ...args, prevResult: { ...prevResult, status: 'success', output: payload } as ProcessorArgs['prevResult'] }
    : args;
  scheduleWake(wakeArgs, deps, { stepId, payload, startedAt, wakeAt });
}

/**
 * Sets the timer that calls {@link wakeSleep} at the occurrence's wake time,
 * or at `retry.notBefore` when that is later, or puts the wake aside for
 * {@link resumeSleepWakes} while the workers of the process are stopped.
 */
function scheduleWake(
  args: ProcessorArgs,
  deps: SleepDeps,
  occurrence: SleepOccurrence,
  retry: Pick<PendingWake, 'attempt' | 'notBefore'> = { attempt: 0, notBefore: 0 },
) {
  const { attempt, notBefore } = retry;
  // A timer set now could publish to workers that stopped; resumeSleepWakes sets it.
  if (pausedScopes.has(deps.scope)) {
    pausedWakes.set(deps.scope, [
      ...(pausedWakes.get(deps.scope) ?? []),
      { args, deps, occurrence, attempt, notBefore },
    ]);
    return;
  }

  let pending = pendingWakes.get(deps.scope);
  if (!pending) {
    pending = new Set();
    pendingWakes.set(deps.scope, pending);
  }

  // One timer per wake, not a repeating one: a timer capped below the wake time fires early, and
  // wakeSleep then calls this again for the rest of the wait.
  const wake: PendingWake = { args, deps, occurrence, attempt, notBefore };
  wake.timer = setTimeout(
    () => {
      pending.delete(wake);
      // wakeSleep logs its own expected outcomes; a rejection is an unexpected store or pubsub failure.
      void wakeSleep(args, deps, occurrence, attempt).catch(error =>
        deps.logger?.error('Failed to wake a sleeping workflow run', {
          workflowId: args.workflowId,
          runId: args.runId,
          stepId: occurrence.stepId,
          error,
        }),
      );
    },
    Math.min(Math.max(0, occurrence.wakeAt - Date.now(), notBefore - Date.now()), MAX_TIMER_DELAY_MS),
  );
  pending.add(wake);
}

/**
 * Whether the stored run already left the sleep at `executionPath`: its
 * `activePaths` moved past the sleep, it finished, or it lists a finished
 * sleep at that path, which a wake marks before publishing the next step.
 *
 * Under `timeTravel` only the first counts. A time-travelled run can still
 * show the status and results of the run it travels from, for example when
 * `shouldPersistSnapshot` leaves out `running` snapshots, and its steps move
 * `activePaths` as they run. When `running` snapshots are left out, the
 * caller skips this check under `timeTravel`, as the step handler skips its
 * finished-step check: a late delivery of the sleep's event then starts it
 * again.
 */
function leftSleep(snapshot: WorkflowRunState, executionPath: number[], timeTravel: boolean): boolean {
  if (movedPastSleep(snapshot, executionPath)) {
    return true;
  }

  // The status and results may still be the travelled-from run's; only the cursor above is this run's.
  if (timeTravel) {
    return false;
  }

  if (FINISHED_RUN_STATUSES.has(snapshot.status)) {
    return true;
  }

  // A run whose cursor is elsewhere, for example in another parallel branch, has not left this sleep.
  if (!samePath(snapshot.activePaths, executionPath)) {
    return false;
  }

  // A wake marks the sleep `success` before it publishes the next step.
  return Object.entries(snapshot.activeStepsPath ?? {}).some(
    ([stepId, path]) => samePath(path, executionPath) && snapshot.context?.[stepId]?.status === 'success',
  );
}

/**
 * The sleep occurrence the stored run is in at `executionPath`: a `waiting`
 * result that the run lists as active at that path. The result stored under
 * `stepId` is preferred; otherwise one is matched by path, because a sleep
 * declared without an `id` gets a new generated id in every process that
 * builds the workflow. A result the run lists at no path is matched by the
 * path stored with it: its process stopped after storing the result and
 * before storing the run's path at the sleep. `wakeAt` is `undefined` for a
 * sleep recorded before wake times were stored.
 */
function sleepInProgress(
  snapshot: WorkflowRunState,
  executionPath: number[],
  stepId: string,
): (Omit<SleepOccurrence, 'wakeAt'> & { wakeAt?: number }) | undefined {
  const active = snapshot.activeStepsPath ?? {};
  const ids = [...new Set([stepId, ...Object.keys(active), ...Object.keys(snapshot.context ?? {})])];

  for (const id of ids) {
    const stored = snapshot.context?.[id];
    const wakeAt = storedWakeAt(stored);
    if (stored?.status !== 'waiting') {
      continue;
    }

    // A result the run lists at another path is another sleep's, whatever path it stored.
    const atPath =
      active[id] === undefined
        ? samePath((stored.metadata as { path?: number[] } | undefined)?.path, executionPath)
        : samePath(active[id], executionPath);
    if (!atPath) {
      continue;
    }

    return { stepId: id, payload: stored.payload, startedAt: stored.startedAt, wakeAt };
  }
}

/**
 * Ends the sleep `occurrence` and publishes the step after it. The sleep's
 * timer calls it. Recovery reaches it by restarting the run once the run's
 * wake key lapsed and the grace period passed, which happens when the timer
 * died with its process: the restart resumes the sleep in whichever process
 * takes it, and the timer it sets fires at once.
 *
 * Waking more than once is a no-op: the wake claims the occurrence's lease
 * (see `claimSleepWake`), and wakes only while the stored run is still active
 * and in this occurrence. It marks the run live and the sleep `success` before
 * publishing, so a restart is refused until the next step takes its own lease,
 * and releases the lease only once the next step was published. When
 * publishing fails, the sleep is put back to `waiting` and the lease left to
 * lapse, so a restart of the run wakes it again.
 *
 * Leases are advisory, so the wake checks that it still holds its lease before
 * marking the sleep `success` and again before publishing, and stops (putting
 * the sleep back to `waiting` if it already marked it) when the lease lapsed or
 * was abandoned meanwhile. A wake stalled past the lease TTL between that check
 * and the publish can still publish twice. A check the store fails tells
 * neither, so the wake stops the same way and tries again later (see
 * {@link retryWake}); `attempt` counts those tries.
 */
async function wakeSleep(args: ProcessorArgs, deps: SleepDeps, occurrence: SleepOccurrence, attempt = 0) {
  const { workflow, workflowId, runId, executionPath, prevResult, requestContext } = args;
  const { pubsub, workflowsStore, leaseStore, scope, logger } = deps;
  const { stepId, payload, startedAt } = occurrence;

  // A process shutting down publishes to workers that are going away; another instance's
  // recovery restarts the run once the sleep is due and the grace period passed.
  if (scope.__shuttingDown) {
    return;
  }

  // A timer capped below a long wake time fires early.
  if (Date.now() < occurrence.wakeAt) {
    return scheduleWake(args, deps, occurrence, { attempt, notBefore: 0 });
  }

  const key = sleepOccurrenceKey(runId, executionPath, startedAt);
  const lease = leaseStore ? await claimSleepWake({ store: leaseStore, key, logger }) : undefined;
  if (lease === 'busy') {
    logger?.debug('Another process is waking this workflow sleep', { workflowId, runId, stepId });
    return;
  }

  // The stored result may show `waiting` again although that wake published the next step.
  if (lease === 'woken') {
    logger?.debug('This workflow sleep was already woken', { workflowId, runId, stepId });
    return markWokenSleepFinished(args, deps, occurrence);
  }

  // pauseSleepWakes interrupts the wakes listed here when the workers stop. An interrupted wake
  // runs again once they start.
  let active = activeWakes.get(scope);
  const wake: ActiveWake | undefined = lease ? { lease, interrupted: false } : undefined;
  if (wake) {
    if (!active) {
      active = new Set();
      activeWakes.set(scope, active);
    }

    active.add(wake);
    // The workers stopped while the claim was on its way, after pauseSleepWakes went through the list.
    if (pausedScopes.has(scope)) {
      wake.interrupted = true;
      wake.lease.abandon();
    }
  }

  // Set when the store failed a lease check: the lease may still be this wake's, so another
  // process need not have taken the sleep over, and this process tries again.
  let checkFailed = false;
  // A lease that lapsed while this wake waited on the store may already be another wake's.
  const lost = async () => {
    if (!lease) {
      return false;
    }

    const held = await lease.check();
    if (held === 'held') {
      return false;
    }

    checkFailed = held === 'unknown';
    logger?.debug('Lost the lease of a workflow sleep while waking it', { workflowId, runId, stepId, held });
    return true;
  };

  let published = false;
  try {
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflowId, runId });
    // A run with no stored state has nothing to check against, and its timer wakes it. Otherwise
    // the run must still be in this very occurrence: a restart, a time travel or a cancel since
    // the timer was set stores a different sleep or none.
    if (snapshot) {
      const stored = snapshot.context?.[stepId];
      const sameSleep =
        (snapshot.status === 'running' || snapshot.status === 'waiting') &&
        stored?.status === 'waiting' &&
        stored.startedAt === startedAt &&
        storedWakeAt(stored) === occurrence.wakeAt;
      if (!sameSleep) {
        logger?.debug('Not waking a workflow sleep the run already left', { workflowId, runId, stepId });
        return;
      }
    }

    // The ancestors too: their own keys lapsed while this nested run slept, and the step after the
    // sleep renews them only once a worker takes it up.
    await Promise.all(deps.wakeRuns.map(run => markRunLive({ scope, store: run.store, runId: run.runId, logger })));

    if (await lost()) {
      return;
    }

    const endedAt = Date.now();
    await workflowsStore?.updateWorkflowResults({
      workflowName: workflowId,
      runId,
      stepId,
      result: { status: 'success', payload, output: payload, startedAt, endedAt },
      requestContext: withoutAuthToken(requestContext ?? {}),
    });
    // The run leaves the sleep; a step after it must not count it as active.
    const { [stepId]: _woken, ...activeStepsPath } = args.activeStepsPath ?? {};
    if (await lost()) {
      await revertWake(args, deps, occurrence, endedAt);
      return;
    }

    try {
      if (workflow.options.emitStepEvents !== false) {
        await pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: {
            type: 'workflow-step-result',
            payload: {
              id: stepId,
              status: 'success',
              payload,
              output: payload,
              startedAt,
              endedAt,
            },
          },
        });
        await pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: { type: 'workflow-step-finish', payload: { id: stepId, metadata: {} } },
        });
      }

      await pubsub.publish('workflows', {
        type: 'workflow.step.run',
        runId,
        data: {
          workflowId,
          runId,
          executionPath: executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]),
          resumeSteps: args.resumeSteps,
          timeTravel: args.timeTravel,
          restart: args.restart,
          stepResults: args.stepResults,
          prevResult,
          resumeData: args.resumeData,
          parentWorkflow: args.parentWorkflow,
          activeStepsPath,
          requestContext,
          actor: args.actor,
          perStep: args.perStep,
        },
      });
      published = true;
    } catch (error) {
      // Back in `waiting`, the sleep is woken again by the restart recovery makes once the run's keys lapse.
      await revertWake(args, deps, occurrence, endedAt).catch(revertError =>
        logger?.error('Failed to put a workflow sleep back to waiting after its wake failed', {
          workflowId,
          runId,
          stepId,
          error: revertError,
        }),
      );
      throw error;
    }
  } finally {
    if (wake) {
      active?.delete(wake);
    }

    // Released only after a publish: the released lease marks the occurrence woken.
    if (published) {
      await lease?.release();
    } else if (lease && wake?.interrupted) {
      // The timer that started this wake is gone, so the wake is kept for resumeSleepWakes. Its own
      // lease would hold the next attempt off for a lease TTL.
      await lease.lapse();
      // The lapsed lease runs out a millisecond later; an attempt within it would find it held.
      scheduleWake(args, deps, occurrence, { attempt, notBefore: Date.now() + LAPSED_LEASE_MARGIN_MS });
    } else {
      // Left to lapse, so another wake can claim the occurrence once this one is surely gone.
      lease?.abandon();
      if (checkFailed) {
        retryWake(args, deps, occurrence, attempt);
      }
    }
  }
}

/**
 * Tries the wake of `occurrence` again after a lease check the store failed:
 * the timer that started it is gone, and with recovery off nothing else would
 * wake the sleep. The next attempt waits for the lease this one abandoned to
 * lapse, at least one lease TTL, doubling with each failed attempt up to
 * {@link MAX_WAKE_RETRY_DELAY_MS}. It claims the lease and checks the stored
 * run again, so a sleep another process woke meanwhile stays woken once.
 */
function retryWake(args: ProcessorArgs, deps: SleepDeps, occurrence: SleepOccurrence, attempt: number) {
  const delay = Math.min(WORKFLOW_RUN_LEASE_TTL_MS * 2 ** attempt, MAX_WAKE_RETRY_DELAY_MS);
  // The jitter keeps the wakes of sleeps that failed together from retrying together.
  const jitter = Math.random() * (WORKFLOW_RUN_LEASE_TTL_MS / 10);
  scheduleWake(args, deps, occurrence, { attempt: attempt + 1, notBefore: Date.now() + delay + jitter });
}

/**
 * Puts the sleep back to `waiting` after its wake wrote `success` but failed
 * to publish the next step, unless the stored result changed since.
 */
async function revertWake(args: ProcessorArgs, deps: SleepDeps, occurrence: SleepOccurrence, endedAt: number) {
  const { workflowId, runId, requestContext } = args;
  const snapshot = await deps.workflowsStore?.loadWorkflowSnapshot({ workflowName: workflowId, runId });
  const stored = snapshot?.context?.[occurrence.stepId];
  // Another wake or a later step may have written the result since; only this wake's own write goes back.
  if (stored?.status !== 'success' || stored.startedAt !== occurrence.startedAt || stored.endedAt !== endedAt) {
    return;
  }

  // A step after the sleep started from this write, so the sleep is woken.
  if (snapshot && movedPastSleep(snapshot, args.executionPath)) {
    return;
  }

  await deps.workflowsStore?.updateWorkflowResults({
    workflowName: workflowId,
    runId,
    stepId: occurrence.stepId,
    result: {
      status: 'waiting',
      payload: occurrence.payload,
      startedAt: occurrence.startedAt,
      metadata: { wakeAt: occurrence.wakeAt, path: args.executionPath },
    },
    requestContext: withoutAuthToken(requestContext ?? {}),
  });
}

/**
 * Marks the sleep `success` when another wake already published the next step
 * but the stored result shows the occurrence `waiting` again, as it does after
 * a restart or a redelivery wrote back what it read before that wake.
 */
async function markWokenSleepFinished(
  args: ProcessorArgs,
  deps: SleepDeps,
  occurrence: Pick<SleepOccurrence, 'stepId' | 'payload' | 'startedAt'>,
) {
  const { workflowId, runId, requestContext } = args;
  const snapshot = await deps.workflowsStore?.loadWorkflowSnapshot({ workflowName: workflowId, runId });
  const stored = snapshot?.context?.[occurrence.stepId];
  // A sleep started again since (a time travel) is another occurrence and keeps its result.
  if (stored?.status !== 'waiting' || stored.startedAt !== occurrence.startedAt) {
    return;
  }

  await deps.workflowsStore?.updateWorkflowResults({
    workflowName: workflowId,
    runId,
    stepId: occurrence.stepId,
    result: {
      status: 'success',
      payload: occurrence.payload,
      output: occurrence.payload,
      startedAt: occurrence.startedAt,
      endedAt: Date.now(),
    },
    requestContext: withoutAuthToken(requestContext ?? {}),
  });
}
