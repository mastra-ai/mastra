import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import type { WorkflowRunChanges } from '../storage/domains/workflows/journal';
import { getStepResult, getStepResultAsync } from './step';
import { stepRefId } from './step-refs';
import type { StepResult, WorkflowRunState } from './types';

/**
 * Tracks what a storage-v2 run has written, so each engine write sends only the
 * step results that changed (and the state, when it changed) instead of the whole snapshot.
 *
 * Step results are replaced, never edited in place, so a step changed when its object
 * differs from the one last written. State is edited in place, so changes are marked
 * through `markStateChanged()` where they are merged into the run.
 *
 * Writes in flight at the same time (parallel branches, `foreach` with concurrency) can
 * commit in any order. A step two of them carry with different values may end up stored
 * with either, so it isn't recorded as written and the next write sends it again. A write
 * that overlaps a checkpoint may have been wiped by it, so the next write is a checkpoint.
 *
 * @internal
 */
export class RunJournal {
  /** stepId -> the object last written for it */
  #written: Map<string, unknown>;
  #stateDirty = false;
  #needsCheckpoint: boolean;
  #inFlight = new Set<InFlightWrite>();

  /**
   * @param seed The step results already in storage (a resume's loaded snapshot context).
   * Without it, the first write is a checkpoint that stores the whole snapshot.
   */
  constructor(seed?: Record<string, unknown>) {
    this.#needsCheckpoint = !seed;
    this.#written = new Map(seed ? Object.entries(seed) : []);
  }

  markStateChanged(): void {
    this.#stateDirty = true;
  }

  async write(
    store: WorkflowsStorage,
    args: { workflowName: string; runId: string; resourceId?: string; snapshot: WorkflowRunState },
  ): Promise<void> {
    const context = args.snapshot.context as Record<string, unknown>;
    const checkpoint = this.#needsCheckpoint;
    const stateDirty = this.#stateDirty;

    let changes: WorkflowRunChanges | undefined;
    if (!checkpoint) {
      changes = {
        stepIds: Object.keys(context).filter(stepId => context[stepId] !== this.#written.get(stepId)),
        // Concurrent writes can commit in any order, so stored state may briefly lag memory.
        // Including state whenever the run stops (suspend, terminal, waiting, paused) makes
        // storage match memory where state is read back.
        state: stateDirty || args.snapshot.status !== 'running',
      };
    }
    const self: InFlightWrite = {
      steps: new Map(changes ? changes.stepIds.map(stepId => [stepId, context[stepId]]) : Object.entries(context)),
      checkpoint,
      unsure: new Set(),
      overlapsCheckpoint: false,
    };
    for (const other of this.#inFlight) {
      if (checkpoint || other.checkpoint) self.overlapsCheckpoint = other.overlapsCheckpoint = true;
      for (const [stepId, value] of self.steps) {
        if (other.steps.has(stepId) && other.steps.get(stepId) !== value) {
          self.unsure.add(stepId);
          other.unsure.add(stepId);
        }
      }
    }
    this.#inFlight.add(self);

    this.#needsCheckpoint = false;
    this.#stateDirty = false;
    try {
      await store.persistWorkflowSnapshot({ ...args, storageVersion: 2, changes });
    } catch (error) {
      if (checkpoint) this.#needsCheckpoint = true;
      if (stateDirty) this.#stateDirty = true;
      throw error;
    } finally {
      this.#inFlight.delete(self);
    }
    if (self.overlapsCheckpoint) this.#needsCheckpoint = true;
    for (const [stepId, value] of self.steps) {
      if (self.unsure.has(stepId)) this.#written.delete(stepId);
      else this.#written.set(stepId, value);
    }
  }
}

interface InFlightWrite {
  /** stepId -> the object this write carries */
  steps: Map<string, unknown>;
  checkpoint: boolean;
  /** Steps another in-flight write carries with a different value. */
  unsure: Set<string>;
  overlapsCheckpoint: boolean;
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
  stepResults: Record<string, StepResult<any, any, any, any>>,
) {
  return {
    getStepResult: engine.getRunJournal(runId)
      ? (step: unknown): never => {
          const stepId = stepRefId(step) ?? String(step);
          throw new MastraError({
            id: 'WORKFLOW_STORAGE_V2_SYNC_GET_STEP_RESULT',
            domain: ErrorDomain.MASTRA_WORKFLOW,
            category: ErrorCategory.USER,
            text: `getStepResult("${stepId}") isn't available in workflows with storageVersion: 2. Use \`await getStepResultAsync("${stepId}")\` instead.`,
          });
        }
      : getStepResult.bind(null, stepResults),
    getStepResultAsync: getStepResultAsync.bind(null, stepResults),
  };
}
