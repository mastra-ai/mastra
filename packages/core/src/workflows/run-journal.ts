import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import { STATE_CHECKPOINT_PATCHES, summarizeStepResult } from '../storage/domains/workflows/journal';
import type { StateRef, StepResultSummary } from '../storage/domains/workflows/journal';
import { getSnapshotMemoryInfo } from '../storage/domains/workflows/snapshot-memory-info';
import { diffState } from '../storage/domains/workflows/state-patch';
import type { StatePatchOp } from '../storage/domains/workflows/state-patch';
import { getStepResult, getStepResultAsync } from './step';
import { stepRefId } from './step-refs';
import type { StepResult, WorkflowRunState, WorkflowRunStatus } from './types';

type StepResults = Record<string, StepResult<any, any, any, any>>;

type StepCopy = { json: unknown; bytes: number; patchBytes: number; write: number };

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
 * about twice its size. A step result that is rewritten before it succeeds (a running foreach
 * recording its finished items) is written the same way, as a `step-patch` on the result last
 * written, once it has been written twice.
 *
 * The start writes of a parallel or branch block's steps are in flight at the same time, and
 * the store can commit them in any order. If two of them carried the same step, the older value
 * could commit last while the journal believes storage holds the newer one, and it never resends
 * what it believes is stored. So a write that can overlap others names its steps (`stepIds`) and
 * sends only those, and overlapping writes name different steps. Everything else (other steps'
 * changes, the state, the checkpoint) goes out with boundary writes, which the engine makes only
 * when no other write of the run is in flight (an entry's end, a loop iteration's start, a
 * finished parallel arm or foreach item, sleeps, the run stopping). `write` throws when a write
 * breaks that.
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
  /**
   * stepId -> a JSON copy of the result last written for it, the JSON size of the patches stored
   * after it was last written in full, and the write of the step it came from (see `#stepWrites`).
   * Only for a result that a later non-success result can be written as a patch on (see `#stepWrite`).
   */
  #writtenCopies = new Map<string, StepCopy>();
  /** stepId -> how many writes that send the step have started */
  #stepWrites = new Map<string, number>();
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
  /** The patches stored after the latest full state or state base. */
  #patchCount: number;
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
  /** The highest `lastSeq` of the run known here: as loaded, or reported by a write or draft. */
  #lastSeq: number | undefined;
  #runToken: string | undefined;
  /** Store calls (writes and drafts) sent and not yet settled. */
  #pending = new Set<Promise<unknown>>();
  #resolveSettledLastSeq!: (seq: number | undefined) => void;
  /**
   * The run's `lastSeq` once its execution has ended (`close`) and every write and draft sent has
   * settled: the version a read of its stored steps must still find to see what the execution left.
   * Undefined when the run wasn't loaded and nothing was stored.
   */
  readonly settledLastSeq: Promise<number | undefined>;
  readonly settledRunToken: Promise<string | undefined>;

  /**
   * @param seed The step results already in storage (a resumed or restarted run's loaded snapshot
   * context). Without it, the first boundary write is a checkpoint that replaces whatever is stored.
   * @param state The state already in storage, with `seed`.
   * @param storedState What the store reported for `state`: its `lastSeq`, `statePatchBytes` and `statePatchCount`.
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
    storedState?: { seq: number; patchBytes: number; patchCount: number; runToken?: string };
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
    this.#patchCount = storedState?.patchCount ?? 0;
    if (resumed && seed) this.#startStateSeq = storedState?.seq;
    this.#lastSeq = storedState?.seq;
    this.#runToken = storedState?.runToken;
    this.settledLastSeq = new Promise(resolve => {
      this.#resolveSettledLastSeq = resolve;
    });
    this.settledRunToken = this.settledLastSeq.then(() => this.#runToken);
  }

  /**
   * Sends a store call, keeping it in `#pending` until it settles and noting the run's `lastSeq` it
   * reports, so `settledLastSeq` cannot resolve before a settled call's seq is noted.
   */
  #send<T>(call: Promise<T>, seqOf: (result: T) => number | undefined): Promise<T> {
    const tracked = call.then(result => {
      const seq = seqOf(result);
      if (seq !== undefined && (this.#lastSeq === undefined || seq > this.#lastSeq)) this.#lastSeq = seq;
      return result;
    });
    this.#pending.add(tracked);
    const settle = () => this.#pending.delete(tracked);
    tracked.then(settle, settle);
    return tracked;
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
      ({ seq } = await this.#send(
        store.appendWorkflowRunStateDraft({
          workflowName: this.workflowName,
          runId: this.runId,
          ...(chained
            ? { on: { seq: current!.ref.seq, draft: current!.ref.draft }, ops: ops! }
            : { state: next.state }),
        }),
        written => written.seq,
      ));
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
    if (this.#closed) return;
    this.#closed = true;
    // Nothing is sent once closed, so these are the last calls.
    void Promise.allSettled(this.#pending).then(() => this.#resolveSettledLastSeq(this.#lastSeq));
  }

  /**
   * @param stepIds Set by a write that can be in flight together with other writes of the run (a
   * step's start write): only these steps are sent, never the state, and no other write in flight
   * may name them. Leave it unset for a boundary write, made when no other write of the run is in
   * flight (an entry's end, a loop iteration's start, a finished parallel arm or foreach item,
   * sleeps, the run stopping): it sends every step result that changed since it was last written,
   * the state's changes, and the checkpoint when that is still to do.
   * @param foreachItems Set by a running foreach's progress write: the foreach's result differs
   * from the one it last wrote only by these indices' `metadata.foreachProgress` entries. When the
   * last written result can be patched, only those entries are sent, so recording a finished item
   * costs that item rather than every item finished so far.
   * @param expectedStatus Sent with the write as the store's compare-and-set guard on the stored status.
   * @returns False when the store rejected the write because of `expectedStatus`. Nothing was
   * stored, as with a write that throws.
   */
  async write({
    resourceId,
    snapshot,
    stepIds,
    foreachItems,
    expectedStatus,
  }: {
    resourceId?: string;
    snapshot: WorkflowRunState;
    stepIds?: readonly string[];
    foreachItems?: { stepId: string; indices: readonly number[] };
    expectedStatus?: WorkflowRunStatus[];
  }): Promise<boolean> {
    const store = this.store;
    if (!store || this.#closed) return true;

    const boundary = stepIds === undefined;
    // The checkpoint replaces every stored entry, so no other write may be in flight with it. The
    // writes dropped here don't need resending: the checkpoint sends the whole run.
    if (!boundary && this.#needsCheckpoint) return true;

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
    }
    const steps: StepResults = {};
    const stepPatches: Record<string, StatePatchOp[]> = {};
    // Built now: the live step results can change while the write is in flight, and a patch has to
    // match the copy kept for its step.
    const sentWrites = sent.map(stepId => {
      const result = results[stepId] as StepResult<any, any, any, any>;
      const write = this.#stepWrite(
        stepId,
        result,
        !checkpoint,
        foreachItems?.stepId === stepId ? foreachItems.indices : undefined,
      );
      if (write.ops) stepPatches[stepId] = write.ops;
      else if (!write.unchanged) steps[stepId] = result;
      return { stepId, result, copy: write.copy, unchanged: write.unchanged };
    });
    const patched = Object.keys(stepPatches).length > 0;
    if (!boundary && !patched && !Object.keys(steps).length) {
      // Results that only changed object are stored as they are.
      this.#recordWritten(sentWrites);
      return true;
    }

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
    for (const { stepId, unchanged } of sentWrites) {
      if (!unchanged) this.#stepWrites.set(stepId, (this.#stepWrites.get(stepId) ?? 0) + 1);
    }

    let writtenState = this.#writtenState;
    let patchBytes = this.#patchBytes;
    let patchCount = this.#patchCount;
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
          patchCount = 0;
        }
        const ops = diffState(writtenState, next.state);
        if (ops.length) {
          const opsBytes = JSON.stringify(ops).length;
          // A full state once the patches would outgrow it, or once a cold load would apply too many.
          if (patchBytes + opsBytes > next.bytes || patchCount >= STATE_CHECKPOINT_PATCHES) {
            state = next.state;
            stateBase = undefined;
          } else {
            statePatch = ops;
            patchBytes += opsBytes;
            patchCount++;
          }
        }
      }
      if (state) {
        patchBytes = 0;
        patchCount = 0;
      }
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
        ...(expectedStatus ? { expectedStatus } : {}),
      };
      const written = await this.#send(
        checkpoint
          ? store.writeWorkflowRunCheckpoint({ ...run, stateBase })
          : store.appendWorkflowRunEntries({ ...run, ...(patched ? { stepPatches } : {}), startStateSeq }),
        written => {
          this.#runToken ??= written?.runToken;
          return written?.lastSeq;
        },
      );
      if (written === null) {
        if (checkpoint) this.#needsCheckpoint = true;
        return false;
      }
      lastSeq = written?.lastSeq;
      this.#startStateSeq = undefined;
    } catch (error) {
      if (checkpoint) this.#needsCheckpoint = true;
      throw error;
    } finally {
      this.#inFlight--;
      if (boundary) this.#boundaryInFlight = false;
    }
    this.#recordWritten(sentWrites);
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
    this.#patchCount = patchCount;
    return true;
  }

  /**
   * How a write sends a step's result: as a patch on the result last written (`ops`), not at all
   * when it holds the same JSON (`unchanged`), else in full. A patch needs both results to be
   * non-success (only a success is summarized, and a step's start and success writes never pay for
   * a copy), the new one to be plain JSON (what JSON keeps as it is), every earlier write of the
   * step to be stored (else the stored result the patch applies to isn't known), and the patches
   * since the last full write to stay within its size, as for the state. `copy` is what
   * `#writtenCopies` holds for the step once the write is stored.
   *
   * With `foreachItems` (see `write`), the patch is built from those entries alone, without
   * serializing the whole result.
   */
  #stepWrite(
    stepId: string,
    result: StepResult<any, any, any, any>,
    mayPatch: boolean,
    foreachItems?: readonly number[],
  ): { ops?: StatePatchOp[]; unchanged?: true; copy: StepCopy | undefined } {
    const previous = this.#written.get(stepId) as { status?: string } | undefined;
    const rewritten = previous !== undefined && previous.status !== 'success' && result?.status !== 'success';
    const started = this.#stepWrites.get(stepId) ?? 0;
    const prior = this.#writtenCopies.get(stepId);
    if (foreachItems && rewritten && mayPatch && prior?.write === started) {
      const progressPatch = foreachProgressPatch(prior, result, foreachItems);
      if (progressPatch === 'unchanged') return { unchanged: true, copy: prior };
      if (progressPatch) {
        const patchBytes = prior.patchBytes + JSON.stringify(progressPatch.ops).length;
        if (patchBytes <= progressPatch.bytes) {
          // Updated in place: the copy is only patched on while it is the step's latest write, and
          // this write becomes that, so a failed write leaves it unused.
          for (const { key, value } of progressPatch.entries) progressPatch.written[key] = value;
          return {
            ops: progressPatch.ops,
            copy: { json: prior.json, bytes: progressPatch.bytes, patchBytes, write: started + 1 },
          };
        }
      }
    }
    const json = rewritten && isPlainJson(result, new Set()) ? JSON.stringify(result) : undefined;
    if (json === undefined) return { copy: undefined };
    const next: unknown = JSON.parse(json);
    if (mayPatch && prior?.write === started) {
      const ops = diffState(prior.json, next);
      if (!ops.length) return { unchanged: true, copy: prior };
      const patchBytes = prior.patchBytes + JSON.stringify(ops).length;
      if (patchBytes <= json.length) {
        return { ops, copy: { json: next, bytes: json.length, patchBytes, write: started + 1 } };
      }
    }
    return { copy: { json: next, bytes: json.length, patchBytes: 0, write: started + 1 } };
  }

  /**
   * Records what a stored write sent. A copy is kept only from the latest write of its step: an
   * earlier write that finishes later doesn't hold what the store has last.
   */
  #recordWritten(writes: readonly { stepId: string; result: unknown; copy: StepCopy | undefined }[]): void {
    for (const { stepId, result, copy } of writes) {
      this.#written.set(stepId, result);
      if (copy && copy.write !== (this.#stepWrites.get(stepId) ?? 0)) continue;
      if (copy) this.#writtenCopies.set(stepId, copy);
      else this.#writtenCopies.delete(stepId);
    }
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

  /** Whether `result` is what the store holds for `stepId`, as of the writes that have settled. */
  isStored(stepId: string, result: unknown): boolean {
    return this.#written.get(stepId) === result;
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
      const result = loaded?.[stepId];
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

/**
 * Whether JSON keeps `value` as it is: only strings, finite numbers, booleans, null, arrays and
 * plain objects (no `Date`, `Error` or other class instance, and no `undefined` array item). An
 * `undefined` object value is allowed: JSON drops the key, which reads back the same.
 */
/**
 * The ops that add a running foreach's newly finished items to the copy of its last written result,
 * and the copy's JSON size with them. `'unchanged'` when every item is in the copy already.
 * Undefined when the copy holds no progress or an item isn't plain JSON: the result is then
 * written the general way.
 */
function foreachProgressPatch(
  prior: StepCopy,
  result: StepResult<any, any, any, any>,
  indices: readonly number[],
):
  | 'unchanged'
  | {
      ops: StatePatchOp[];
      entries: { key: string; value: unknown }[];
      written: Record<string, unknown>;
      bytes: number;
    }
  | undefined {
  const written = (prior.json as { metadata?: { foreachProgress?: unknown } } | null)?.metadata?.foreachProgress;
  const live = (result as { metadata?: { foreachProgress?: Record<string, unknown> } }).metadata?.foreachProgress;
  if (typeof written !== 'object' || written === null || !live) return undefined;
  const progress = written as Record<string, unknown>;
  const ops: StatePatchOp[] = [];
  const entries: { key: string; value: unknown }[] = [];
  let bytes = prior.bytes;
  for (const index of indices) {
    const key = String(index);
    // A finished item's entry never changes, so one in the copy is already stored.
    if (Object.hasOwn(progress, key) || !Object.hasOwn(live, key)) continue;
    if (!isPlainJson(live[key], new Set())) return undefined;
    const json = JSON.stringify(live[key]);
    const value: unknown = JSON.parse(json);
    ops.push({ op: 'set', path: ['metadata', 'foreachProgress', key], value });
    entries.push({ key, value });
    // `"key":value,` in the result's JSON.
    bytes += key.length + json.length + 4;
  }
  return ops.length ? { ops, entries, written: progress, bytes } : 'unchanged';
}

function isPlainJson(value: unknown, ancestors: Set<object>): boolean {
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object': {
      if (value === null) return true;
      if (ancestors.has(value)) return false;
      const proto = Object.getPrototypeOf(value);
      if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) return false;
      ancestors.add(value);
      let plain = true;
      if (Array.isArray(value)) {
        for (let i = 0; plain && i < value.length; i++) plain = isPlainJson(value[i], ancestors);
      } else {
        for (const item of Object.values(value)) {
          if (item !== undefined && !isPlainJson(item, ancestors)) {
            plain = false;
            break;
          }
        }
      }
      ancestors.delete(value);
      return plain;
    }
    default:
      return false;
  }
}

/** The `steps` loader of a storage v2 result -> the step results it was built from (see `residentStepResults`). */
const residentResults = new WeakMap<object, StepResults>();

/**
 * The `steps()` of a storage v2 run's result: its step results as the execution left them, formatted
 * by `format`. The successful results the journal evicted are read from storage on the first call,
 * with one read shared by concurrent calls; the read fails if the run was written to since its
 * execution ended (e.g. resumed or restarted), since storage then no longer holds what the result
 * describes. A failed read isn't cached, so a later call retries.
 *
 * Holds the stubs and the results that weren't evicted until the run's writes settle; then the
 * stored successful results are evicted too, so it holds only stubs, `input` and the results a
 * reader needs without loading (suspended, failed, running). Call it after the run's last write is
 * sent, and close the journal before anything awaits the loader.
 *
 * @internal
 */
export function lazyStepResults(
  journal: RunJournal,
  stepResults: StepResults,
  format: (stepResults: StepResults) => StepResults,
): () => Promise<StepResults> {
  const results = { ...stepResults };
  evictOnceStored(journal, results);
  const { store, workflowName, runId, settledLastSeq, settledRunToken } = journal;
  return storedStepResults(
    { store: store!, workflowName, runId, lastSeq: settledLastSeq, runToken: settledRunToken },
    results,
    format,
  );
}

// Kept apart from `lazyStepResults`, so the loader it returns doesn't hold on to the journal.
function evictOnceStored(journal: RunJournal, results: StepResults): void {
  void journal.settledLastSeq.then(() => {
    for (const [stepId, result] of Object.entries(results)) {
      if (
        stepId !== 'input' &&
        result?.status === 'success' &&
        !isStepResultStub(result) &&
        journal.isStored(stepId, result)
      ) {
        results[stepId] = stubStepResult(result);
      }
    }
  });
}

/**
 * The `steps()` of a storage v2 result reconstructed from stored state. Holds successful-step
 * stubs and hydrates them on the first call while the stored run identity and `lastSeq` still match.
 *
 * @internal
 */
export function loadedStepResults(
  {
    store,
    workflowName,
    runId,
    lastSeq,
    runToken,
  }: { store: WorkflowsStorage; workflowName: string; runId: string; lastSeq: number; runToken?: string },
  stepResults: StepResults,
  format: (stepResults: StepResults) => StepResults,
): () => Promise<StepResults> {
  const results: StepResults = {};
  for (const [stepId, result] of Object.entries(stepResults)) {
    results[stepId] =
      stepId !== 'input' && result?.status === 'success' && !isStepResultStub(result) ? stubStepResult(result) : result;
  }
  return storedStepResults(
    { store, workflowName, runId, lastSeq: Promise.resolve(lastSeq), runToken: Promise.resolve(runToken) },
    results,
    format,
  );
}

function storedStepResults(
  {
    store,
    workflowName,
    runId,
    lastSeq,
    runToken,
  }: {
    store: WorkflowsStorage;
    workflowName: string;
    runId: string;
    lastSeq: Promise<number | undefined>;
    runToken: Promise<string | undefined>;
  },
  results: StepResults,
  format: (stepResults: StepResults) => StepResults,
): () => Promise<StepResults> {
  let loaded: Promise<StepResults> | undefined;

  const load = async (): Promise<StepResults> => {
    const expectedLastSeq = await lastSeq;
    const expectedRunToken = await runToken;
    const stubbed = Object.keys(results).filter(stepId => isStepResultStub(results[stepId]));
    if (!stubbed.length && expectedLastSeq === undefined) return format(results);

    const stored = await store.loadWorkflowRunSteps({
      workflowName,
      runId,
      stepIds: stubbed,
      expectedLastSeq,
      expectedRunToken,
    });
    if (!stored) {
      throw new MastraError({
        id: 'WORKFLOW_STORAGE_V2_STEPS_STALE',
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.USER,
        text: `The steps of run ${runId} can't be loaded for this result: the run was written to (e.g. resumed or restarted) or deleted since. Read the run again for its current steps.`,
      });
    }
    const full = { ...results };
    for (const stepId of stubbed) {
      const result = stored[stepId];
      if (!result) {
        throw new MastraError({
          id: 'WORKFLOW_STORAGE_V2_STEP_RESULT_MISSING',
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
          text: `The stored result of step "${stepId}" in run ${runId} is missing.`,
        });
      }
      full[stepId] = result;
    }
    return format(full);
  };

  const steps = () => {
    loaded ??= load().catch(error => {
      loaded = undefined;
      throw error;
    });
    return loaded;
  };
  residentResults.set(steps, results);
  return steps;
}

/**
 * The step results a storage v2 result's `steps` loader holds without reading storage: every result
 * but the successful ones that were evicted, which are stubs. Undefined for anything else (a v1
 * result's `steps` record). For the engine's own reads of a nested run's suspended and failed steps.
 *
 * @internal
 */
export function residentStepResults(steps: unknown): StepResults | undefined {
  return typeof steps === 'function' ? residentResults.get(steps) : undefined;
}

/**
 * Every step result of a run's result: a storage v2 result's `steps` loader is called, a v1
 * result's record returned as is. For the framework's readers that hand all of them on.
 *
 * @internal
 */
export async function loadStepResults(steps: unknown): Promise<StepResults> {
  return typeof steps === 'function' ? steps() : (steps as StepResults);
}
