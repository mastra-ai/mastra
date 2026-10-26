import type { StepResult, WorkflowRunState } from '../../../workflows';
import { normalizePerPage } from '../../base';
import { matchesRunFence, resolveRunFence, RunFenceConflictError } from '../../run-fencing';
import type {
  ClaimRunOwnershipInput,
  ClaimRunOwnershipResult,
  RenewRunOwnershipInput,
  RenewRunOwnershipResult,
  RunFence,
  RunOwnershipRecord,
} from '../../run-fencing';
import type {
  StorageWorkflowRun,
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
} from '../../types';
import { matchesExpectedWorkflowStatus } from '../../types';
import { createEmptyWorkflowSnapshot, mergeWorkflowStepResult } from '../../workflow-snapshot';
import type { InMemoryDB } from '../inmemory-db';
import { WorkflowsStorage } from './base';
import { inheritsState, materializeState, materializeWorkflowRun, summarizeStepResult } from './journal';
import type { StoredWorkflowRun, StoredWorkflowRunHeader, WorkflowRunEntry, WorkflowRunHeader } from './journal';
import { getSnapshotMemoryInfo } from './snapshot-memory-info';
import type { StatePatchOp } from './state-patch';

/**
 * Deep-clone in-memory workflow state.
 *
 * We previously used `JSON.parse(JSON.stringify(x))` here, but the agent loop
 * and workflow engine legitimately place values in step results that don't
 * survive JSON round-tripping:
 * - `Date` instances (e.g. `response.timestamp`) — JSON turns them into ISO
 *   strings, downstream consumers that do `.getTime()` then break.
 * - Explicitly-`undefined` properties (e.g. `headers`, `providerMetadata`,
 *   `usage.{cacheRead, cacheWrite, reasoning}`) — JSON drops keys with
 *   `undefined` values, breaking snapshot assertions that include them.
 * - `Error` instances (e.g. tool execution failures, AssertionErrors from
 *   inside `tool.execute`) — JSON strips `message`/`name`/`stack` (non-
 *   enumerable). `structuredClone` isn't enough either — it preserves the
 *   Error type but drops subclass-specific enumerable props (`actual`,
 *   `expected`, `operator`).
 *
 * The custom walk below preserves all of that. It also handles builtins with
 * internal slots explicitly — `Map`, `Set`, `RegExp`, `URL`, `ArrayBuffer`,
 * typed arrays, and `DataView` — because cloning them via `Object.create(proto)`
 * would produce a value that passes `instanceof` but whose methods throw (the
 * internal slots were never initialized). Null-prototype dictionaries keep
 * their null prototype.
 */
/** @internal Exported for testing only. */
export function cloneRunData<T>(value: T): T {
  return deepCloneForRun(value, new WeakMap()) as T;
}

function deepCloneForRun(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== 'object') return value;
  const cached = seen.get(value as object);
  if (cached !== undefined) return cached;

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags);
  }

  if (value instanceof URL) {
    return new URL(value.href);
  }

  if (value instanceof Map) {
    const out = new Map();
    seen.set(value, out);
    for (const [k, v] of value) {
      out.set(deepCloneForRun(k, seen), deepCloneForRun(v, seen));
    }
    return out;
  }

  if (value instanceof Set) {
    const out = new Set();
    seen.set(value, out);
    for (const v of value) {
      out.add(deepCloneForRun(v, seen));
    }
    return out;
  }

  if (value instanceof ArrayBuffer) {
    return value.slice(0);
  }

  // Typed arrays and DataView — `Object.create(proto)` would yield a shell with
  // no backing buffer, so rebuild against a fresh copy of the underlying bytes.
  if (ArrayBuffer.isView(value)) {
    if (value instanceof DataView) {
      return new DataView(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    }
    const typed = value as unknown as Uint8Array;
    return new (typed.constructor as Uint8ArrayConstructor)(typed);
  }

  if (value instanceof Error) {
    // Clone via Object.create(proto) so `instanceof Error` and subclass
    // branches keep working (e.g. `expect.any(Error)`) without invoking
    // subclass constructors that may have non-standard signatures
    // (AssertionError expects an options object). Surface `message` as an
    // enumerable own prop so Vitest's snapshot serializer renders it
    // alongside subclass-specific fields.
    const out = Object.create(Object.getPrototypeOf(value)) as Error;
    Object.defineProperty(out, 'message', {
      value: value.message,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    Object.defineProperty(out, 'name', { value: value.name, writable: true, configurable: true });
    // For `stack`, defer to the Error's own `toJSON` if present — that's how
    // producers signal whether they want stack persisted (e.g. step-executor
    // wraps via `getErrorFromUnknown(err, { serializeStack: false })` so the
    // attached toJSON omits stack from the JSON form). We only honour
    // toJSON's stack signal here, not its other fields, to avoid pulling in
    // subclass extras like Chai AssertionError.toJSON's name/ok/stack that
    // the agent-loop snapshot tests don't expect.
    const errRecord = value as unknown as Record<string, unknown>;
    let includeStack = value.stack !== undefined;
    if (includeStack && typeof errRecord.toJSON === 'function') {
      try {
        const serialized = (errRecord.toJSON as () => unknown)();
        if (serialized && typeof serialized === 'object' && !('stack' in serialized)) {
          includeStack = false;
        }
      } catch {
        // Defensive: if toJSON throws, fall back to default behaviour.
      }
    }
    if (includeStack) {
      Object.defineProperty(out, 'stack', { value: value.stack, writable: true, configurable: true });
    }
    // Register in `seen` BEFORE recursing so cycles (incl. self-referential
    // `cause`) terminate.
    seen.set(value, out);
    const outRecord = out as unknown as Record<string, unknown>;
    if (value.cause !== undefined) outRecord.cause = deepCloneForRun(value.cause, seen);
    for (const key of Object.keys(value)) {
      outRecord[key] = deepCloneForRun(errRecord[key], seen);
    }
    return out;
  }

  if (Array.isArray(value)) {
    const out: unknown[] = new Array(value.length);
    seen.set(value, out);
    for (let i = 0; i < value.length; i++) {
      out[i] = deepCloneForRun(value[i], seen);
    }
    return out;
  }

  // Preserve the prototype so class instances stay recognizable to consumers
  // (e.g. `DefaultStepResult` in the agent loop, anything that uses `instanceof`
  // or Vitest's snapshot serializer which prints the class name) and so
  // null-prototype dictionaries (`Object.create(null)`) keep their null proto
  // rather than silently becoming plain `{}`. Builtins with internal slots
  // (Map/Set/RegExp/typed arrays/Date/Error) are handled explicitly above, so
  // the only objects reaching here are plain objects and plain data-holder
  // class instances — `Object.create(proto)` + an own-property copy reproduces
  // those faithfully.
  const proto = Object.getPrototypeOf(value);
  const out: Record<string, unknown> =
    proto === Object.prototype ? {} : (Object.create(proto) as Record<string, unknown>);
  seen.set(value, out);
  // `Object.keys` includes keys whose value is `undefined`, so explicitly-undefined
  // properties are preserved (unlike a JSON round-trip).
  for (const key of Object.keys(value as object)) {
    out[key] = deepCloneForRun((value as Record<string, unknown>)[key], seen);
  }
  return out;
}

export class WorkflowsInMemory extends WorkflowsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  supportsConcurrentUpdates(): boolean {
    return true;
  }

  supportsRunJournal(): boolean {
    return true;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.workflows.clear();
    this.db.workflowRunHeaders.clear();
    this.db.workflowRunEntries.clear();
    this.db.runOwners.clear();
  }

  private getWorkflowKey(workflowName: string, runId: string): string {
    return `${workflowName}-${runId}`;
  }

  /**
   * The parent state a storage v2 run's state starts from: the state of the run in
   * `header.parentWorkflow` when the run inherits it, else undefined. `{}` when the parent isn't
   * stored. Not cloned.
   */
  private parentStateOf(
    header: WorkflowRunHeader,
    entries: readonly WorkflowRunEntry[],
  ): Record<string, any> | undefined {
    const parent = header.parentWorkflow;
    if (!parent || !inheritsState(entries)) return undefined;
    const key = this.getWorkflowKey(parent.workflowId, parent.runId);
    const record = this.db.workflowRunHeaders.get(key);
    if (!record) return {};
    const parentEntries = this.db.workflowRunEntries.get(key) ?? [];
    return materializeState(parentEntries, this.parentStateOf(record.header, parentEntries)).state;
  }

  /** A storage v2 run as a v1 row, with its state rebuilt from the entries. Not cloned. */
  private materializedRow(
    key: string,
  ): (StorageWorkflowRun & { snapshot: WorkflowRunState; storageVersion: 2 }) | null {
    const record = this.db.workflowRunHeaders.get(key);
    if (!record) return null;
    const entries = this.db.workflowRunEntries.get(key) ?? [];
    return {
      workflow_name: record.workflow_name,
      run_id: record.run_id,
      resourceId: record.resourceId,
      snapshot: materializeWorkflowRun(record.header, entries, this.parentStateOf(record.header, entries)),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      storageVersion: 2,
    };
  }

  /** v1 rows, then v2 rows, optionally narrowed before v2 state is rebuilt. */
  private allRows(
    include: (row: { workflow_name: string; run_id: string }) => boolean = () => true,
  ): Array<StorageWorkflowRun & { storageVersion?: 2 }> {
    const rows: Array<StorageWorkflowRun & { storageVersion?: 2 }> = Array.from(this.db.workflows.values()).filter(
      include,
    );
    for (const [key, record] of this.db.workflowRunHeaders) {
      if (include(record)) rows.push(this.materializedRow(key)!);
    }
    return rows;
  }

  // Every ownership operation and fenced write below checks and writes without
  // awaiting in between, which makes each one atomic on the single JS thread.

  supportsRunFencing(): boolean {
    return true;
  }

  private ownershipRecord(runId: string): RunOwnershipRecord | null {
    const owner = this.db.runOwners.get(runId);
    if (!owner) return null;
    return {
      runId,
      generation: owner.generation,
      ownerId: owner.ownerId,
      leaseExpiresAt: owner.leaseExpiresAt ? new Date(owner.leaseExpiresAt) : null,
      live: !!owner.leaseExpiresAt && owner.leaseExpiresAt.getTime() > Date.now(),
    };
  }

  private assertFence(explicit: RunFence | undefined, runId: string, operation: string): void {
    const fence = resolveRunFence(this, explicit, runId);
    if (fence && !matchesRunFence(this.db.runOwners.get(fence.runId), fence)) {
      throw new RunFenceConflictError(fence, operation);
    }
  }

  async claimRunOwnership({
    runId,
    ownerId,
    leaseMs,
    force,
    expectedGeneration,
  }: ClaimRunOwnershipInput): Promise<ClaimRunOwnershipResult> {
    const current = this.ownershipRecord(runId);
    if (expectedGeneration !== undefined && (current?.generation ?? 0) !== expectedGeneration) {
      return { acquired: false, record: current };
    }
    if (current?.live && !force) {
      return { acquired: false, record: current };
    }
    this.db.runOwners.set(runId, {
      generation: current ? current.generation + 1 : Math.max(1, Date.now()),
      ownerId,
      leaseExpiresAt: new Date(Date.now() + leaseMs),
    });
    return { acquired: true, record: this.ownershipRecord(runId)! };
  }

  async renewRunOwnership({ leaseMs, ...fence }: RenewRunOwnershipInput): Promise<RenewRunOwnershipResult> {
    const owner = this.db.runOwners.get(fence.runId);
    if (!owner?.leaseExpiresAt || !matchesRunFence(owner, fence)) {
      return { renewed: false, record: this.ownershipRecord(fence.runId) };
    }
    owner.leaseExpiresAt = new Date(Date.now() + leaseMs);
    return { renewed: true, record: this.ownershipRecord(fence.runId)! };
  }

  async releaseRunOwnership(fence: RunFence): Promise<boolean> {
    const owner = this.db.runOwners.get(fence.runId);
    if (!owner || !matchesRunFence(owner, fence)) return false;
    owner.leaseExpiresAt = null;
    return true;
  }

  async getRunOwnership({ runId }: { runId: string }): Promise<RunOwnershipRecord | null> {
    return this.ownershipRecord(runId);
  }

  async updateWorkflowResults({
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
    state?: Record<string, any>;
    fence?: RunFence;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    this.assertFence(fence, runId, 'updateWorkflowResults');
    const key = this.getWorkflowKey(workflowName, runId);
    const run = this.db.workflows.get(key);

    if (!run) {
      if (this.db.workflowRunHeaders.has(key)) {
        throw new Error(`updateWorkflowResults does not support storage v2 runs (run ${runId})`);
      }
      return {};
    }

    let snapshot: WorkflowRunState;
    if (!run.snapshot) {
      snapshot = createEmptyWorkflowSnapshot(run.run_id);

      this.db.workflows.set(key, {
        ...run,
        snapshot,
      });
    } else {
      snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;
    }

    if (!snapshot || !snapshot?.context) {
      throw new Error(`Snapshot not found for runId ${runId}`);
    }

    const context = mergeWorkflowStepResult({ snapshot, stepId, result, requestContext, state });

    this.db.workflows.set(key, {
      ...run,
      snapshot: snapshot,
    });

    return cloneRunData(context);
  }

  async updateWorkflowState({
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
    storageVersion?: 1 | 2;
  }): Promise<WorkflowRunState | undefined> {
    this.assertFence(fence, runId, 'updateWorkflowState');
    const key = this.getWorkflowKey(workflowName, runId);

    const record = storageVersion === 1 ? undefined : this.db.workflowRunHeaders.get(key);
    if (record) {
      const { expectedStatus, ...patch } = opts;
      if (!matchesExpectedWorkflowStatus(record.header.status, expectedStatus)) {
        return;
      }
      record.header = { ...record.header, ...cloneRunData(patch) };
      return cloneRunData(this.materializedRow(key)!.snapshot);
    }
    if (storageVersion === 2) {
      return;
    }

    const run = this.db.workflows.get(key);

    if (!run) {
      return;
    }

    let snapshot: WorkflowRunState;
    if (!run.snapshot) {
      snapshot = createEmptyWorkflowSnapshot(run.run_id);

      this.db.workflows.set(key, {
        ...run,
        snapshot,
      });
    } else {
      snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;
    }

    if (!snapshot || !snapshot?.context) {
      throw new Error(`Snapshot not found for runId ${runId}`);
    }

    const { expectedStatus, ...state } = opts;
    if (!matchesExpectedWorkflowStatus(snapshot.status, expectedStatus)) {
      return;
    }

    snapshot = { ...snapshot, ...state };
    this.db.workflows.set(key, {
      ...run,
      snapshot: snapshot,
    });

    return snapshot;
  }

  async loadWorkflowRunHeader({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<StoredWorkflowRunHeader | null> {
    const record = this.db.workflowRunHeaders.get(this.getWorkflowKey(workflowName, runId));
    return record ? { header: cloneRunData(record.header), lastSeq: record.lastSeq } : null;
  }

  async loadWorkflowRun({
    workflowName,
    runId,
    successfulSteps,
  }: {
    workflowName: string;
    runId: string;
    successfulSteps: 'full' | 'summary';
  }): Promise<StoredWorkflowRun | null> {
    const key = this.getWorkflowKey(workflowName, runId);
    const record = this.db.workflowRunHeaders.get(key);
    if (!record) return null;

    // Map keeps each step at its first write while later entries replace the value.
    const latest = new Map<string, any>();
    const entries = this.db.workflowRunEntries.get(key) ?? [];
    for (const entry of entries) {
      if (entry.kind === 'step') latest.set(entry.stepId, entry.result);
    }
    const { state, statePatchBytes } = materializeState(entries, this.parentStateOf(record.header, entries));

    const steps: StoredWorkflowRun['steps'] = {};
    const summarizedStepIds: string[] = [];
    for (const [stepId, result] of latest) {
      // `input` is the run's input, not a step result.
      if (successfulSteps === 'summary' && stepId !== 'input' && result?.status === 'success') {
        // Clone only the summary, never the data the summary leaves out.
        steps[stepId] = cloneRunData(summarizeStepResult(result));
        summarizedStepIds.push(stepId);
      } else {
        steps[stepId] = cloneRunData(result);
      }
    }
    return {
      header: cloneRunData(record.header),
      lastSeq: record.lastSeq,
      state: cloneRunData(state),
      statePatchBytes,
      steps,
      summarizedStepIds,
    };
  }

  async loadWorkflowRunSteps({
    workflowName,
    runId,
    stepIds,
  }: {
    workflowName: string;
    runId: string;
    stepIds: string[];
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    const wanted = new Set(stepIds);
    const steps: Record<string, StepResult<any, any, any, any>> = {};
    for (const entry of this.db.workflowRunEntries.get(this.getWorkflowKey(workflowName, runId)) ?? []) {
      if (entry.kind === 'step' && wanted.has(entry.stepId)) {
        steps[entry.stepId] = entry.result as StepResult<any, any, any, any>;
      }
    }
    return cloneRunData(steps);
  }

  async updateWorkflowRunHeader({
    workflowName,
    runId,
    opts,
    fence,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
    fence?: RunFence;
  }): Promise<StoredWorkflowRunHeader | undefined> {
    this.assertFence(fence, runId, 'updateWorkflowRunHeader');
    const record = this.db.workflowRunHeaders.get(this.getWorkflowKey(workflowName, runId));
    if (!record) return;
    const { expectedStatus, ...patch } = opts;
    if (!matchesExpectedWorkflowStatus(record.header.status, expectedStatus)) return;
    record.header = { ...record.header, ...cloneRunData(patch) };
    return { header: cloneRunData(record.header), lastSeq: record.lastSeq };
  }

  async writeWorkflowRunCheckpoint(args: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    header: WorkflowRunHeader;
    steps: Record<string, StepResult<any, any, any, any>>;
    state?: Record<string, any>;
    statePatch?: StatePatchOp[];
    fence?: RunFence;
  }): Promise<void> {
    this.assertFence(args.fence, args.runId, 'writeWorkflowRunCheckpoint');
    this.writeRunEntries({ ...args, append: false });
  }

  async appendWorkflowRunEntries(args: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    header: WorkflowRunHeader;
    steps: Record<string, StepResult<any, any, any, any>>;
    state?: Record<string, any>;
    statePatch?: StatePatchOp[];
    fence?: RunFence;
  }): Promise<void> {
    this.assertFence(args.fence, args.runId, 'appendWorkflowRunEntries');
    this.writeRunEntries({ ...args, append: true });
  }

  /** Writes the header and one entry per step, then the state or state patch. A checkpoint first drops the old entries. */
  private writeRunEntries({
    workflowName,
    runId,
    resourceId,
    header,
    steps,
    state,
    statePatch,
    append,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    header: WorkflowRunHeader;
    steps: Record<string, StepResult<any, any, any, any>>;
    state?: Record<string, any>;
    statePatch?: StatePatchOp[];
    append: boolean;
  }): void {
    const key = this.getWorkflowKey(workflowName, runId);
    const existing = this.db.workflowRunHeaders.get(key);
    const now = new Date();
    let seq = existing?.lastSeq ?? 0;
    const entries: WorkflowRunEntry[] = append ? (this.db.workflowRunEntries.get(key) ?? []) : [];
    for (const [stepId, result] of Object.entries(steps)) {
      entries.push({ seq: ++seq, kind: 'step', stepId, result: cloneRunData(result) });
    }
    if (state !== undefined) {
      entries.push({ seq: ++seq, kind: 'state', state: cloneRunData(state) });
    } else if (statePatch !== undefined) {
      entries.push({ seq: ++seq, kind: 'state-patch', ops: cloneRunData(statePatch) });
    }
    this.db.workflowRunHeaders.set(key, {
      workflow_name: workflowName,
      run_id: runId,
      resourceId: resourceId ?? existing?.resourceId,
      header: cloneRunData(header),
      lastSeq: seq,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    this.db.workflowRunEntries.set(key, entries);
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot,
    createdAt,
    updatedAt,
    fence,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
    fence?: RunFence;
  }): Promise<void> {
    this.assertFence(fence, runId, 'persistWorkflowSnapshot');
    const key = this.getWorkflowKey(workflowName, runId);
    const now = new Date();
    const existing = this.db.workflows.get(key);
    const data: StorageWorkflowRun = {
      workflow_name: workflowName,
      run_id: runId,
      // A re-persist without a resourceId (e.g. resume) must not erase a
      // previously-set value. Matches the persistent stores' COALESCE upserts.
      resourceId: resourceId ?? existing?.resourceId,
      snapshot,
      // Preserve the original creation time when re-persisting an existing run; only set it
      // on first insert. Otherwise listWorkflowRuns ordering and date filters drift to the
      // last activity time. Matches the persistent stores (pg/mysql/mongodb/libsql).
      createdAt: createdAt ?? existing?.createdAt ?? now,
      updatedAt: updatedAt ?? now,
    };

    this.db.workflows.set(key, data);
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
    storageVersion,
  }: {
    workflowName: string;
    runId: string;
    storageVersion?: 1 | 2;
  }): Promise<WorkflowRunState | null> {
    const key = this.getWorkflowKey(workflowName, runId);
    const v2 = storageVersion === 1 ? null : this.materializedRow(key);
    if (v2) {
      return cloneRunData(v2.snapshot);
    }
    const run = storageVersion === 2 ? undefined : this.db.workflows.get(key);

    if (!run) {
      return null;
    }

    const snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;
    // Return a deep copy to prevent mutation
    return snapshot ? cloneRunData(snapshot) : null;
  }

  async listWorkflowRuns({
    workflowName,
    fromDate,
    toDate,
    perPage,
    page,
    resourceId,
    threadId,
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    if (page !== undefined && page < 0) {
      throw new Error('page must be >= 0');
    }

    let runs = this.allRows(row => !workflowName || row.workflow_name === workflowName);

    if (status) {
      runs = runs.filter((run: any) => {
        let snapshot: WorkflowRunState | string = run?.snapshot!;

        if (!snapshot) {
          return false;
        }

        if (typeof snapshot === 'string') {
          try {
            snapshot = JSON.parse(snapshot) as WorkflowRunState;
          } catch {
            return false;
          }
        } else {
          snapshot = cloneRunData(snapshot) as WorkflowRunState;
        }

        return snapshot.status === status;
      });
    }

    if (fromDate && toDate) {
      runs = runs.filter(
        (run: any) =>
          new Date(run.createdAt).getTime() >= fromDate.getTime() &&
          new Date(run.createdAt).getTime() <= toDate.getTime(),
      );
    } else if (fromDate) {
      runs = runs.filter((run: any) => new Date(run.createdAt).getTime() >= fromDate.getTime());
    } else if (toDate) {
      runs = runs.filter((run: any) => new Date(run.createdAt).getTime() <= toDate.getTime());
    }
    if (resourceId) runs = runs.filter((run: any) => run.resourceId === resourceId);
    if (threadId) {
      runs = runs.filter((run: any) => {
        let snapshot: WorkflowRunState | string = run?.snapshot!;

        if (!snapshot) {
          return false;
        }

        if (typeof snapshot === 'string') {
          try {
            snapshot = JSON.parse(snapshot) as WorkflowRunState;
          } catch {
            return false;
          }
        }

        return getSnapshotMemoryInfo(snapshot)?.threadId === threadId;
      });
    }

    const total = runs.length;

    // Sort by createdAt
    runs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    if (perPage !== undefined && page !== undefined) {
      // Use MAX_SAFE_INTEGER as default to maintain "no pagination" behavior when undefined
      const normalizedPerPage = normalizePerPage(perPage, Number.MAX_SAFE_INTEGER);
      const offset = page * normalizedPerPage;
      const start = offset;
      const end = start + normalizedPerPage;
      runs = runs.slice(start, end);
    }

    // Deserialize snapshot if it's a string
    const parsedRuns = runs.map((run: any) => ({
      ...run,
      snapshot: typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : cloneRunData(run.snapshot),
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.updatedAt),
      runId: run.run_id,
      workflowName: run.workflow_name,
      resourceId: run.resourceId,
    }));

    return { runs: parsedRuns as WorkflowRun[], total };
  }

  async getWorkflowRunById({
    runId,
    workflowName,
    storageVersion,
  }: {
    runId: string;
    workflowName?: string;
    storageVersion?: 1 | 2;
  }): Promise<WorkflowRun | null> {
    // `workflowName` is optional in the storage contract. The pg/libsql adapters
    // match by `runId` alone when it is omitted and return the most recent run
    // (ORDER BY createdAt DESC LIMIT 1), so mirror that here.
    const run = this.allRows(r => r.run_id === runId && (!workflowName || r.workflow_name === workflowName))
      .filter(r => !storageVersion || (r.storageVersion ?? 1) === storageVersion)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!run) return null;

    // Return a deep copy to prevent mutation
    const parsedRun = {
      ...run,
      snapshot: typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : cloneRunData(run.snapshot),
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.updatedAt),
      runId: run.run_id,
      workflowName: run.workflow_name,
      resourceId: run.resourceId,
    };

    return parsedRun as WorkflowRun;
  }

  async deleteWorkflowRunById({
    runId,
    workflowName,
    fence,
  }: {
    runId: string;
    workflowName: string;
    fence?: RunFence;
  }): Promise<void> {
    this.assertFence(fence, runId, 'deleteWorkflowRunById');
    const key = this.getWorkflowKey(workflowName, runId);
    this.db.workflows.delete(key);
    this.db.workflowRunHeaders.delete(key);
    this.db.workflowRunEntries.delete(key);
  }
}
