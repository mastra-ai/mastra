import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import { summarizeStepResult } from '../storage/domains/workflows/journal';
import type { StepResultSummary } from '../storage/domains/workflows/journal';
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
 * Tracks what a storage-v2 run has written, so each engine write sends only the
 * step results that changed (and the state, when it changed) instead of the whole snapshot.
 * It also lets the engine drop stored results from memory (`evict`) and read them back
 * (`hydrate`, `getStepResultAsync`).
 *
 * Step results are replaced, never edited in place, so a step changed when its object
 * differs from the one last written. State is edited in place, so changes are marked
 * through `markStateChanged()` where they are merged into the run.
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
  #stateDirty = false;
  #needsCheckpoint: boolean;
  /** Store writes sent and not yet settled, and whether one of them is a boundary write. */
  #inFlight = 0;
  #boundaryInFlight = false;
  #closed = false;

  /**
   * @param seed The step results already in storage (a resumed or restarted run's loaded snapshot
   * context). Without it, the first boundary write is a checkpoint that replaces whatever is stored.
   */
  constructor({
    store,
    workflowName,
    runId,
    seed,
  }: {
    store: WorkflowsStorage | undefined;
    workflowName: string;
    runId: string;
    seed?: Record<string, unknown>;
  }) {
    this.store = store;
    this.workflowName = workflowName;
    this.runId = runId;
    this.#needsCheckpoint = !seed;
    this.#written = new Map(seed ? Object.entries(seed) : []);
  }

  markStateChanged(): void {
    this.#stateDirty = true;
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
   * result that changed since it was last written, the state when it changed or the run stops, and
   * the checkpoint when that is still to do.
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
    const stateDirty = this.#stateDirty;

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

    this.#needsCheckpoint = false;
    if (boundary) this.#stateDirty = false;
    this.#inFlight++;
    if (boundary) this.#boundaryInFlight = true;
    try {
      const run = { workflowName: this.workflowName, runId: this.runId, resourceId, header, steps };
      if (checkpoint) {
        await store.writeWorkflowRunCheckpoint({ ...run, state: value });
      } else {
        // Writing the state whenever the run stops (suspend, terminal, waiting, paused) keeps
        // storage matching memory where the state is read back.
        const writeState = boundary && (stateDirty || snapshot.status !== 'running');
        await store.appendWorkflowRunEntries({ ...run, state: writeState ? value : undefined });
      }
    } catch (error) {
      if (checkpoint) this.#needsCheckpoint = true;
      if (stateDirty) this.#stateDirty = true;
      throw error;
    } finally {
      this.#inFlight--;
      if (boundary) this.#boundaryInFlight = false;
    }
    for (const stepId of sent) {
      this.#written.set(stepId, steps[stepId]);
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
