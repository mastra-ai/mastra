import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import { summarizeStepResult } from '../storage/domains/workflows/journal';
import type { StateRef, StepResultSummary } from '../storage/domains/workflows/journal';
import { getSnapshotMemoryInfo } from '../storage/domains/workflows/snapshot-memory-info';
import { diffState } from '../storage/domains/workflows/state-patch';
import type { StatePatchOp } from '../storage/domains/workflows/state-patch';
import { getStepResult, getStepResultAsync } from './step';
import { stepRefId } from './step-refs';
import type { StepResult, WorkflowRunState } from './types';

type StepResults = Record<string, StepResult<any, any, any, any>>;

// Private to this module, so only the journal can make an object count as a stub. A spread or
// clone of a stub is a new object, so it isn't one.
const stubs = new WeakSet<object>();

/**
 * A stand-in for a successful step result that is stored but no longer held in memory: the
 * result's summary fields, without its data. `RunJournal.hydrate` swaps it back for the stored
 * result.
 *
 * @internal
 */
export function stubStepResult(result: StepResultSummary): StepResult<any, any, any, any> {
  const stub = summarizeStepResult(result);
  stubs.add(stub);
  // A stub keeps `status: 'success'` but has no `output`, so it isn't a full `StepResult`.
  // Readers that need more than the summary hydrate it first.
  return stub as StepResult<any, any, any, any>;
}

/** @internal */
export function isStepResultStub(value: unknown): boolean {
  return typeof value === 'object' && value !== null && stubs.has(value);
}

/**
 * A version of a stored run state (possibly another run's), and a JSON copy of that state, which
 * is shared and never edited.
 *
 * @internal
 */
export type StateBase = { ref: StateRef; state: Record<string, unknown> };

/**
 * What a storage v2 parent hands a nested workflow step: a stored version of the parent's state
 * for a nested run starting from `state` to build on, undefined when it stores a full copy.
 *
 * @internal
 */
export type ParentStateLink = (state: unknown) => Promise<StateBase | undefined>;

/**
 * Tracks what a storage-v2 run has written, so each engine write sends only the
 * step results that changed (and the state's changes) instead of the whole snapshot.
 * It also lets the engine drop stored results from memory (`evict`) and read them back
 * (`hydrate`, `getStepResultAsync`).
 *
 * Step results are replaced, never edited in place, so a step changed when its object
 * differs from the one last written. State can be edited in place, so the journal keeps a
 * JSON copy of the state it last wrote and diffs the live state against it. A change is written
 * as a patch, unless the patches written since the latest full state would outgrow the state:
 * then the full state is written again, so reading the state back never replays more than
 * about twice its size.
 *
 * The start writes of a parallel or branch block's steps are in flight at the same time, and
 * the store can commit them in any order. If two of them carried the same step, the older value
 * could commit last while the journal believes storage holds the newer one, and it never resends
 * what it believes is stored. So a write that can overlap others names its steps (`stepIds`) and
 * sends only those, and overlapping writes name different steps. Everything else (other steps'
 * changes, the state, the checkpoint) goes out with boundary writes, which the engine makes only
 * when no other write of the run is in flight (an entry's end, a loop iteration's start, sleeps,
 * the run stopping). `write` throws when a write breaks that.
 *
 * @internal
 */
export class RunJournal {
  /** Undefined when Mastra has no storage: nothing is written, so nothing is evicted. */
  readonly store: WorkflowsStorage | undefined;
  readonly workflowName: string;
  readonly runId: string;
  /** stepId -> the object last written for it (a stub once evicted) */
  #written: Map<string, unknown>;
  /** A JSON copy of the stored state. Replaced on each write, never edited. */
  #writtenState: Record<string, unknown> | undefined;
  /**
   * The stored state version `#writtenState` is, when known. Before the checkpoint of a nested run
   * built on its parent's state, a version of the parent's state.
   */
  #writtenRef: StateRef | undefined;
  /** The version a nested run's checkpoint builds on (`inherited`). */
  #inheritedRef: StateRef | undefined;
  /** JSON size of the patches stored after the latest full state. */
  #patchBytes: number;
  /** The latest draft of the live state written for nested runs to build on, since the last state write. */
  #draft: StateBase | undefined;
  /** JSON size of the draft patches chained since the latest full draft or state write. */
  #draftBytes = 0;
  /** Serializes `baseFor`, so concurrent nested starts share one draft. */
  #drafting: Promise<unknown> = Promise.resolve();
  #needsCheckpoint: boolean;
  /** A resumed drive's start state version, until an append has recorded it. */
  #startStateSeq: number | undefined;
  /** Store writes sent and not yet settled, and whether one of them is a boundary write. */
  #inFlight = 0;
  #boundaryInFlight = false;
  #closed = false;

  /**
   * @param seed The step results already in storage (a resumed or restarted run's loaded snapshot
   * context). Without it, the first boundary write is a checkpoint that replaces whatever is stored.
   * @param state The state already in storage, with `seed`.
   * @param storedState What the store reported for `state`: its `lastSeq`, and its `statePatchBytes`.
   * @param inherited For a nested run that starts from a version of its parent's state (the parent
   * journal's `baseFor`): the checkpoint stores that version as the base, and only the changes to it.
   * @param resumed Set for a resume: the run's new drive starts from `storedState`, which the first
   * append records as the run's `startStateSeq`.
   */
  constructor({
    store,
    workflowName,
    runId,
    seed,
    state,
    storedState,
    inherited,
    resumed,
  }: {
    store: WorkflowsStorage | undefined;
    workflowName: string;
    runId: string;
    seed?: Record<string, unknown>;
    state?: unknown;
    storedState?: { seq: number; patchBytes: number };
    inherited?: StateBase;
    resumed?: boolean;
  }) {
    this.store = store;
    this.workflowName = workflowName;
    this.runId = runId;
    this.#needsCheckpoint = !seed;
    this.#written = new Map(seed ? Object.entries(seed) : []);
    if (inherited) {
      this.#writtenState = inherited.state;
      this.#writtenRef = inherited.ref;
      this.#inheritedRef = inherited.ref;
    } else if (seed && state !== undefined) {
      this.#writtenState = normalizeState(state).state;
      if (storedState) this.#writtenRef = { workflowName, runId, seq: storedState.seq };
    }
    this.#patchBytes = storedState?.patchBytes ?? 0;
    if (resumed && seed) this.#startStateSeq = storedState?.seq;
  }

  /**
   * A stored version of this run's state, for a nested run starting from `state` to build on: the
   * stored state or the latest draft when `state` matches it, else a new draft of `state` (a patch
   * on the latest version, or the full state once the draft patches would outgrow it). Undefined
   * when there is nothing to build on (no store, the run isn't stored, a state that isn't JSON).
   *
   * Drafts don't change the run's state, so a restart never reads them: they only hold the live
   * state that a block's earlier steps changed, so the nested runs of a foreach or a loop each store
   * only their own changes.
   */
  baseFor(state: unknown): Promise<StateBase | undefined> {
    const result = this.#drafting.then(() => this.#baseFor(state));
    this.#drafting = result.catch(() => undefined);
    return result;
  }

  async #baseFor(state: unknown): Promise<StateBase | undefined> {
    const store = this.store;
    if (!store || this.#closed) return undefined;
    let next: { state: Record<string, unknown>; bytes: number };
    try {
      next = normalizeState(state);
    } catch {
      return undefined;
    }
    const current: StateBase | undefined =
      this.#draft ?? (this.#writtenRef && this.#writtenState && { ref: this.#writtenRef, state: this.#writtenState });
    const ops = current && diffState(current.state, next.state);
    if (current && !ops!.length) return current;

    const own = current && current.ref.workflowName === this.workflowName && current.ref.runId === this.runId;
    const opsBytes = ops ? JSON.stringify(ops).length : 0;
    const chained = own && this.#draftBytes + opsBytes <= next.bytes;
    let seq: number;
    try {
      ({ seq } = await store.appendWorkflowRunStateDraft({
        workflowName: this.workflowName,
        runId: this.runId,
        ...(chained ? { on: { seq: current!.ref.seq, draft: current!.ref.draft }, ops: ops! } : { state: next.state }),
      }));
    } catch {
      return undefined;
    }
    this.#draftBytes = chained ? this.#draftBytes + opsBytes : 0;
    this.#draft = { ref: { workflowName: this.workflowName, runId: this.runId, seq, draft: true }, state: next.state };
    return this.#draft;
  }

  /**
   * Called when the run's execution ends. A step of a parallel or branch block can still be
   * running then (the block's `Promise.all` rejects on the first failure), and its write is dropped.
   */
  close(): void {
    this.#closed = true;
  }

  /**
   * @param stepIds Set by a write that can be in flight together with other writes of the run (a
   * step's start write): only these steps are sent, never the state, and no other write in flight
   * may name them. Leave it unset for a boundary write, made when no other write of the run is in
   * flight (an entry's end, a loop iteration's start, sleeps, the run stopping): it sends every step
   * result that changed since it was last written, the state's changes, and the checkpoint when
   * that is still to do.
   */
  async write({
    resourceId,
    snapshot,
    stepIds,
  }: {
    resourceId?: string;
    snapshot: WorkflowRunState;
    stepIds?: readonly string[];
  }): Promise<void> {
    const store = this.store;
    if (!store || this.#closed) return;

    const boundary = stepIds === undefined;
    // The checkpoint replaces every stored entry, so no other write may be in flight with it. The
    // writes dropped here don't need resending: the checkpoint sends the whole run.
    if (!boundary && this.#needsCheckpoint) return;

    const { context, value, ...header } = snapshot;
    const results = context as Record<string, unknown>;
    const checkpoint = this.#needsCheckpoint;

    let sent: string[];
    if (checkpoint) {
      sent = Object.keys(results);
      // A checkpoint replaces every entry, so a stub would replace a stored result with its summary.
      // Stubs only replace written results and the first write is the checkpoint, so this can't happen.
      const stubbed = sent.filter(stepId => isStepResultStub(results[stepId]));
      if (stubbed.length) {
        throw new MastraError({
          id: 'WORKFLOW_STORAGE_V2_CHECKPOINT_STUB',
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
          text: `Storage v2 run ${this.runId} can't write a checkpoint while step results are evicted (${stubbed.join(', ')}).`,
        });
      }
    } else {
      // Every stub stands for a result that is already stored. A stub can still differ from the
      // last written object: a copy of the step results taken before a hydrate holds the stub the
      // hydrate replaced. Sending it would overwrite the stored result.
      sent = (stepIds ?? Object.keys(results)).filter(
        stepId =>
          stepId in results && results[stepId] !== this.#written.get(stepId) && !isStepResultStub(results[stepId]),
      );
      if (!boundary && !sent.length) return;
    }
    const steps: StepResults = {};
    for (const stepId of sent) steps[stepId] = results[stepId] as StepResult<any, any, any, any>;

    // The engine makes boundary writes only where nothing else of the run is running. Failing here
    // finds an engine path that breaks that before it loses a write.
    if (this.#boundaryInFlight || (boundary && this.#inFlight > 0)) {
      throw new MastraError({
        id: 'WORKFLOW_STORAGE_V2_OVERLAPPING_WRITE',
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.SYSTEM,
        text: `Storage v2 run ${this.runId} started a write while ${boundary ? 'another write' : 'a boundary write'} was in flight.`,
      });
    }

    let writtenState = this.#writtenState;
    let patchBytes = this.#patchBytes;
    let state: Record<string, unknown> | undefined;
    let stateBase: StateRef | undefined;
    let statePatch: StatePatchOp[] | undefined;
    if (boundary) {
      const next = normalizeState(value);
      if (writtenState === undefined || (checkpoint && !this.#inheritedRef)) {
        state = next.state;
      } else {
        if (checkpoint) {
          // The checkpoint starts the state over, from the inherited version.
          stateBase = this.#inheritedRef;
          patchBytes = 0;
        }
        const ops = diffState(writtenState, next.state);
        if (ops.length) {
          const opsBytes = JSON.stringify(ops).length;
          if (patchBytes + opsBytes > next.bytes) {
            state = next.state;
            stateBase = undefined;
          } else {
            statePatch = ops;
            patchBytes += opsBytes;
          }
        }
      }
      if (state) patchBytes = 0;
      if (state || statePatch) writtenState = next.state;
    }

    this.#needsCheckpoint = false;
    this.#inFlight++;
    if (boundary) this.#boundaryInFlight = true;
    let lastSeq: number | undefined;
    const startStateSeq = this.#startStateSeq;
    try {
      // Stubs only replace successful results other than `input`, and the thread comes from a
      // suspended result or `input`, so the snapshot still holds the whole run's thread.
      const threadId = getSnapshotMemoryInfo(snapshot)?.threadId;
      const run = {
        workflowName: this.workflowName,
        runId: this.runId,
        resourceId,
        threadId,
        header,
        steps,
        state,
        statePatch,
      };
      const written = checkpoint
        ? await store.writeWorkflowRunCheckpoint({ ...run, stateBase })
        : await store.appendWorkflowRunEntries({ ...run, startStateSeq });
      lastSeq = written?.lastSeq;
      this.#startStateSeq = undefined;
    } catch (error) {
      if (checkpoint) this.#needsCheckpoint = true;
      throw error;
    } finally {
      this.#inFlight--;
      if (boundary) this.#boundaryInFlight = false;
    }
    for (const stepId of sent) {
      this.#written.set(stepId, steps[stepId]);
    }
    if (checkpoint || state || statePatch) {
      this.#writtenRef =
        lastSeq === undefined ? undefined : { workflowName: this.workflowName, runId: this.runId, seq: lastSeq };
    }
    if (checkpoint) this.#inheritedRef = undefined;
    // The stored state is the live state now, so drafts of it are stale.
    if (boundary) {
      this.#draft = undefined;
      this.#draftBytes = 0;
    }
    this.#writtenState = writtenState;
    this.#patchBytes = patchBytes;
  }

  /**
   * Replace stored successful results with stubs, except `input` and the steps in `keep`.
   * Only results that are exactly what was last written are replaced, so nothing the store
   * doesn't have is dropped.
   */
  evict(stepResults: StepResults, keep: readonly string[]): void {
    if (!this.store) return;
    const kept = new Set(keep);
    for (const [stepId, result] of Object.entries(stepResults)) {
      if (
        // `getInitData()` reads the run's input synchronously.
        stepId === 'input' ||
        kept.has(stepId) ||
        // Suspended, running and failed results are read synchronously on resume and restart.
        result?.status !== 'success' ||
        isStepResultStub(result) ||
        // Skipped writes (`shouldPersistSnapshot`) and results replaced since the last write
        // aren't stored as they are in memory.
        this.#written.get(stepId) !== result
      ) {
        continue;
      }
      const stub = stubStepResult(result);
      stepResults[stepId] = stub;
      // Holding the written object here would keep the result in memory.
      this.#written.set(stepId, stub);
    }
  }

  /** Swap the stubs among `stepIds` back for their stored results, with one read. */
  async hydrate(stepResults: StepResults, stepIds: readonly string[] = Object.keys(stepResults)): Promise<void> {
    const store = this.store;
    const stubbed = new Map<string, unknown>();
    for (const stepId of stepIds) {
      if (isStepResultStub(stepResults[stepId])) stubbed.set(stepId, stepResults[stepId]);
    }
    if (!store || !stubbed.size) return;

    const loaded = await store.loadWorkflowRunSteps({
      workflowName: this.workflowName,
      runId: this.runId,
      stepIds: [...stubbed.keys()],
    });
    for (const [stepId, stub] of stubbed) {
      // A result that changed while the read was in flight (e.g. a parallel branch hydrated it)
      // is at least as new as the one read.
      if (stepResults[stepId] !== stub) continue;
      const result = loaded[stepId];
      if (!result) {
        throw new MastraError({
          id: 'WORKFLOW_STORAGE_V2_STEP_RESULT_MISSING',
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
          text: `The stored result of step "${stepId}" in run ${this.runId} is missing. The run was deleted or overwritten while it ran.`,
        });
      }
      stepResults[stepId] = result;
      // The loaded result is what's stored, so the next write doesn't resend it.
      this.#written.set(stepId, result);
    }
  }

  /** `getStepResultAsync` for step code: reads an evicted step from storage first. */
  async getStepResultAsync(stepResults: StepResults, step: unknown): Promise<any> {
    const stepId = stepRefId(step);
    if (stepId !== undefined && isStepResultStub(stepResults[stepId])) {
      // The result stays in memory until the entry ends, so later reads in the entry are free.
      await this.hydrate(stepResults, [stepId]);
    }
    return getStepResult(stepResults, step);
  }
}

/**
 * The `getStepResult` / `getStepResultAsync` pair handed to step code. On storage v2
 * runs, sync `getStepResult` throws: their step results won't always be in memory.
 *
 * @internal
 */
export function buildStepResultAccessors(
  engine: { getRunJournal(runId: string): RunJournal | undefined },
  runId: string,
  stepResults: StepResults,
): { getStepResult: (step: any) => any; getStepResultAsync: (step: any) => Promise<any> } {
  const journal = engine.getRunJournal(runId);
  if (!journal) {
    return {
      getStepResult: getStepResult.bind(null, stepResults),
      getStepResultAsync: getStepResultAsync.bind(null, stepResults),
    };
  }
  return {
    getStepResult: (step: unknown): never => {
      const stepId = stepRefId(step) ?? String(step);
      throw new MastraError({
        id: 'WORKFLOW_STORAGE_V2_SYNC_GET_STEP_RESULT',
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.USER,
        text: `getStepResult("${stepId}") isn't available in workflows with storageVersion: 2. Use \`await getStepResultAsync("${stepId}")\` instead.`,
      });
    },
    getStepResultAsync: (step: unknown) => journal.getStepResultAsync(stepResults, step),
  };
}

/**
 * The state as a JSON store keeps it (a `Date` becomes its ISO string, `undefined` keys drop), and
 * its JSON size.
 */
function normalizeState(state: unknown): {
  state: Record<string, unknown>;
  bytes: number;
} {
  const json = JSON.stringify(state ?? {});
  return { state: JSON.parse(json), bytes: json.length };
}
