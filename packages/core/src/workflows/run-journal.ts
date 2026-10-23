import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import { summarizeStepResult } from '../storage/domains/workflows/journal';
import type { StepResultSummary } from '../storage/domains/workflows/journal';
import { getSnapshotMemoryInfo } from '../storage/domains/workflows/snapshot-memory-info';
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

  /**
   * @param seed The step results already in storage (a resume's loaded snapshot context).
   * Without it, the first write is a checkpoint that stores the whole snapshot.
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

  async write({ resourceId, snapshot }: { resourceId?: string; snapshot: WorkflowRunState }): Promise<void> {
    const store = this.store;
    if (!store) return;

    const { context, value, ...header } = snapshot;
    const results = context as Record<string, unknown>;
    const checkpoint = this.#needsCheckpoint;
    const stateDirty = this.#stateDirty;

    let stepIds = Object.keys(results);
    if (checkpoint) {
      // A checkpoint replaces every entry, so a stub would replace a stored result with its summary.
      // Stubs only replace written results and the first write is the checkpoint, so this can't happen.
      const stubbed = stepIds.filter(stepId => isStepResultStub(results[stepId]));
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
      // last written object: a copy of the step results (a step's `running` write) taken before
      // a hydrate holds the stub the hydrate replaced. Sending it would overwrite the stored result.
      stepIds = stepIds.filter(
        stepId => results[stepId] !== this.#written.get(stepId) && !isStepResultStub(results[stepId]),
      );
    }
    const steps: StepResults = {};
    for (const stepId of stepIds) steps[stepId] = results[stepId] as StepResult<any, any, any, any>;

    this.#needsCheckpoint = false;
    this.#stateDirty = false;
    try {
      // Stubs only replace successful results other than `input`, and the thread comes from a
      // suspended result or `input`, so the snapshot still holds the whole run's thread.
      const threadId = getSnapshotMemoryInfo(snapshot)?.threadId;
      const run = { workflowName: this.workflowName, runId: this.runId, resourceId, threadId, header, steps };
      if (checkpoint) {
        await store.writeWorkflowRunCheckpoint({ ...run, state: value });
      } else {
        // Concurrent writes can commit in any order, so stored state may briefly lag memory.
        // Including state whenever the run stops (suspend, terminal, waiting, paused) makes
        // storage match memory where state is read back.
        const writeState = stateDirty || snapshot.status !== 'running';
        await store.appendWorkflowRunEntries({ ...run, state: writeState ? value : undefined });
      }
    } catch (error) {
      if (checkpoint) this.#needsCheckpoint = true;
      if (stateDirty) this.#stateDirty = true;
      throw error;
    }
    for (const stepId of stepIds) {
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
