import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { StepResult, WorkflowRunState } from '../../../workflows';
import type {
  ClaimRunOwnershipInput,
  ClaimRunOwnershipResult,
  RenewRunOwnershipInput,
  RenewRunOwnershipResult,
  RunFence,
  RunOwnershipRecord,
} from '../../run-fencing';
import { runFencingNotSupportedError } from '../../run-fencing';
import type { UpdateWorkflowStateOptions, WorkflowRun, WorkflowRuns, StorageListWorkflowRunsInput } from '../../types';
import { StorageDomain } from '../base';
import type { StoredWorkflowRun, StoredWorkflowRunHeader, WorkflowRunHeader } from './journal';

function runJournalNotSupportedError(adapter: string): MastraError {
  return new MastraError({
    id: 'STORAGE_RUN_JOURNAL_NOT_SUPPORTED',
    domain: ErrorDomain.STORAGE,
    category: ErrorCategory.USER,
    text: `${adapter} does not support storage v2 runs. Check supportsRunJournal() before calling storage v2 methods.`,
  });
}

export abstract class WorkflowsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'WORKFLOWS',
    });
  }

  abstract supportsConcurrentUpdates(): boolean;

  /**
   * Whether this adapter implements run ownership: the claim/renew/release
   * operations below, and rejecting writes whose fence is no longer the run's
   * current claim, atomically with the write itself. A write's fence is its
   * `fence` argument, otherwise the one `resolveRunFence()` returns for the
   * run it writes.
   *
   * This fences workflow writes only. A run is fully fenced only when the
   * memory store it writes to supports run fencing too, which a composite
   * store taking its domains from different adapters, or an agent whose
   * memory has its own storage, does not guarantee. Otherwise an execution
   * that lost the run can no longer write here, but its messages, threads and
   * working memory still land.
   *
   * A rejected write throws a `RunFenceConflictError` itself, not wrapped in
   * another error, and writes nothing.
   *
   * Adapters that return true must pass the run-fencing conformance suite.
   * An adapter that has to probe its backend to know returns a promise, and
   * rejects when the probe fails: it must never answer false and later true.
   */
  supportsRunFencing(): boolean | Promise<boolean> {
    return false;
  }

  /**
   * Whether this adapter stores storage v2 runs (`storageVersion: 2`): a header plus
   * append-only entries, written and read by the storage v2 methods below.
   * Reads without a `storageVersion` hint must find runs of either version.
   * @experimental
   */
  supportsRunJournal(): boolean {
    return false;
  }

  /**
   * Claim a run for an execution. Succeeds when the run has no live owner, or
   * when `force` is set, and increments the run's generation. Lease expiry is
   * computed on the store's clock. Every claim, renewal and release sets
   * `updatedAt` from the store's clock.
   *
   * A run with no record starts at the store's clock in epoch milliseconds (at
   * least 1) rather than 1. Retention prunes ownership records and memory
   * fences independently, so a run claimed again after `workflows.runOwnership`
   * retention pruned its record must still outrank any fence or stream event
   * left from before. This relies on the store's clock not moving backward
   * between the two claims.
   *
   * Later claims increment by 1 rather than reading the clock again. A takeover
   * then depends only on the stored generation, which the atomic claim already
   * reads, so clock skew cannot affect it. The generation orders claims; it is
   * not a timestamp.
   */
  async claimRunOwnership(_args: ClaimRunOwnershipInput): Promise<ClaimRunOwnershipResult> {
    throw runFencingNotSupportedError('workflows', this.constructor.name);
  }

  /**
   * Extend the lease. Succeeds only while `ownerId` and `generation` still
   * hold the run and the claim has not been released.
   */
  async renewRunOwnership(_args: RenewRunOwnershipInput): Promise<RenewRunOwnershipResult> {
    throw runFencingNotSupportedError('workflows', this.constructor.name);
  }

  /**
   * Give up a claim by clearing its lease, so the run can be claimed without
   * `force`. The record keeps its generation and owner, and the released
   * owner's late writes are still accepted until the run is claimed again or
   * its record is pruned. Returns false if the claim was no longer current.
   */
  async releaseRunOwnership(_args: RunFence): Promise<boolean> {
    throw runFencingNotSupportedError('workflows', this.constructor.name);
  }

  async getRunOwnership(_args: { runId: string }): Promise<RunOwnershipRecord | null> {
    throw runFencingNotSupportedError('workflows', this.constructor.name);
  }

  // Storage v2 runs. Adapters that return true from supportsRunJournal() implement these.

  /**
   * A storage v2 run's header, without reading its entries. Null when the run isn't stored as v2.
   * @experimental
   */
  async loadWorkflowRunHeader(_args: { workflowName: string; runId: string }): Promise<StoredWorkflowRunHeader | null> {
    throw runJournalNotSupportedError(this.constructor.name);
  }

  /**
   * A storage v2 run's header, latest state and latest result per step. With
   * `successfulSteps: 'summary'`, successful steps come back as summaries
   * (`summarizeStepResult`) and are listed in `summarizedStepIds`.
   * @experimental
   */
  async loadWorkflowRun(_args: {
    workflowName: string;
    runId: string;
    successfulSteps: 'full' | 'summary';
  }): Promise<StoredWorkflowRun | null> {
    throw runJournalNotSupportedError(this.constructor.name);
  }

  /**
   * The latest result of each given step of a storage v2 run. Steps without an entry are left out.
   * @experimental
   */
  async loadWorkflowRunSteps(_args: {
    workflowName: string;
    runId: string;
    stepIds: string[];
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    throw runJournalNotSupportedError(this.constructor.name);
  }

  /**
   * Patch a storage v2 run's header. With `opts.expectedStatus`, only when the stored status
   * matches. Returns the updated header, or undefined when the run isn't stored or the status
   * didn't match.
   * @experimental
   */
  async updateWorkflowRunHeader(_args: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
    fence?: RunFence;
  }): Promise<StoredWorkflowRunHeader | undefined> {
    throw runJournalNotSupportedError(this.constructor.name);
  }

  /**
   * Replace all of a storage v2 run's entries with one per step, in the given order, then
   * the state. Writes the header, creating the run if it isn't stored.
   *
   * `threadId` is the whole run's thread (`getSnapshotMemoryInfo`), passed on every write.
   * Stores that keep it next to the header filter `listWorkflowRuns` by it without reading entries.
   * @experimental
   */
  async writeWorkflowRunCheckpoint(_args: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    threadId?: string;
    header: WorkflowRunHeader;
    steps: Record<string, StepResult<any, any, any, any>>;
    state: Record<string, any>;
    fence?: RunFence;
  }): Promise<void> {
    throw runJournalNotSupportedError(this.constructor.name);
  }

  /**
   * Append one entry per given step to a storage v2 run, then the state when given. Writes
   * the header, creating the run if it isn't stored.
   *
   * `threadId` is the whole run's thread, as for `writeWorkflowRunCheckpoint`, not only the given steps'.
   * @experimental
   */
  async appendWorkflowRunEntries(_args: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    threadId?: string;
    header: WorkflowRunHeader;
    steps: Record<string, StepResult<any, any, any, any>>;
    state?: Record<string, any>;
    fence?: RunFence;
  }): Promise<void> {
    throw runJournalNotSupportedError(this.constructor.name);
  }

  /**
   * In-memory, LibSQL, and PostgreSQL storage return an empty object without writing when the workflow run does not
   * exist. Remaining adapters are being aligned under COR-1448; callers must not rely on this method to create the
   * initial run snapshot. Not supported for storage v2 runs.
   */
  abstract updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
    state,
    fence,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
    /**
     * Workflow state to record as `context.__state` in the same atomic update as
     * the step result, so a crash can't persist one without the other.
     */
    state?: Record<string, any>;
    fence?: RunFence;
  }): Promise<Record<string, StepResult<any, any, any, any>>>;

  /**
   * `storageVersion` picks the store to patch. Without it, adapters that support run journals
   * patch the run wherever it is stored.
   */
  abstract updateWorkflowState({
    workflowName,
    runId,
    opts,
    fence,
    storageVersion,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
    fence?: RunFence;
    /** @experimental */
    storageVersion?: 1 | 2;
  }): Promise<WorkflowRunState | undefined>;

  abstract persistWorkflowSnapshot(_: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
    fence?: RunFence;
  }): Promise<void>;

  /**
   * `storageVersion` limits the lookup to one store. Without it, adapters that support run
   * journals look in both.
   */
  abstract loadWorkflowSnapshot({
    workflowName,
    runId,
    storageVersion,
  }: {
    workflowName: string;
    runId: string;
    /** @experimental */
    storageVersion?: 1 | 2;
  }): Promise<WorkflowRunState | null>;

  /** Adapters that support run journals list runs of both versions. */
  abstract listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns>;

  /**
   * `storageVersion` limits the lookup to one store. Without it, adapters that support run
   * journals look in both.
   */
  abstract getWorkflowRunById(args: {
    runId: string;
    workflowName?: string;
    /** @experimental */
    storageVersion?: 1 | 2;
  }): Promise<WorkflowRun | null>;

  abstract deleteWorkflowRunById(args: { runId: string; workflowName: string; fence?: RunFence }): Promise<void>;
}
