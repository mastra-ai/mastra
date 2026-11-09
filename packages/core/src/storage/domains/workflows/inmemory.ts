import { randomUUID } from 'node:crypto';
import type { StepResult, WorkflowRunState, WorkflowRunStatus } from '../../../workflows';
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
import {
  latestStepResults,
  materializeState,
  materializeWorkflowRun,
  stateBaseOf,
  summarizeStepResult,
} from './journal';
import type {
  StateRef,
  StateVersion,
  StoredWorkflowRun,
  StoredWorkflowRunHeader,
  WorkflowRunEntry,
  WorkflowRunHeader,
} from './journal';
import { LeafAdoptionConflictError } from './leaves';
import type {
  AdoptWorkflowLeafArgs,
  AdoptWorkflowLeafResult,
  WorkflowLeafAdoptionReceipt,
  WorkflowLeafRecordKind,
} from './leaves';
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

  supportsGuardedSnapshotWrites(): boolean {
    return true;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.workflows.clear();
    this.db.workflowRunHeaders.clear();
    this.db.workflowRunEntries.clear();
    this.db.workflowLeafRecords.clear();
    this.db.runOwners.clear();
  }

  private getWorkflowKey(workflowName: string, runId: string): string {
    return `${workflowName}-${runId}`;
  }

  /**
   * A storage v2 run's state, latest or as of `at`, with its `state-base` resolved recursively.
   * `{}` when the run isn't stored. Not cloned.
   */
  private stateOf(
    workflowName: string,
    runId: string,
    at?: StateVersion,
  ): { state: Record<string, any>; statePatchBytes: number } {
    const key = this.getWorkflowKey(workflowName, runId);
    if (!this.db.workflowRunHeaders.has(key)) return { state: {}, statePatchBytes: 0 };
    const entries = this.db.workflowRunEntries.get(key) ?? [];
    const ref = stateBaseOf(entries, at);
    const base = ref ? this.stateOf(ref.workflowName, ref.runId, ref).state : undefined;
    return materializeState(entries, { at, base });
  }

  /**
   * Whether a run's state version is still stored: its draft entry, or for a stored version a
   * full state or state base at or below it (a checkpoint drops the old ones unless `stateShared`).
   * A version past the run's `lastSeq` isn't written yet, so a run can only build on state that
   * existed before it, and state bases can't form a loop.
   */
  private hasStateVersion(ref: StateRef): boolean {
    const key = this.getWorkflowKey(ref.workflowName, ref.runId);
    const header = this.db.workflowRunHeaders.get(key);
    if (!header || ref.seq > header.lastSeq) return false;
    return (this.db.workflowRunEntries.get(key) ?? []).some(entry =>
      ref.draft
        ? entry.kind === 'state-draft' && entry.seq === ref.seq
        : (entry.kind === 'state' || entry.kind === 'state-base') && entry.seq <= ref.seq,
    );
  }

  /**
   * Before a run is deleted, store the full state in place of every `state-base` entry built on it,
   * so the runs built on it keep reading the same state.
   */
  private detachStateChildren(workflowName: string, runId: string): void {
    for (const entries of this.db.workflowRunEntries.values()) {
      entries.forEach((entry, i) => {
        if (entry.kind !== 'state-base') return;
        if (entry.base.workflowName !== workflowName || entry.base.runId !== runId) return;
        const state = cloneRunData(this.stateOf(workflowName, runId, entry.base).state);
        entries[i] = { seq: entry.seq, kind: 'state', state };
      });
    }
  }

  /** A storage v2 run as a v1 row, with its state rebuilt from the entries. Not cloned. */
  private materializedRow(
    key: string,
  ): (StorageWorkflowRun & { snapshot: WorkflowRunState; storageVersion: 2 }) | null {
    const record = this.db.workflowRunHeaders.get(key);
    if (!record) return null;
    const entries = this.db.workflowRunEntries.get(key) ?? [];
    const ref = stateBaseOf(entries);
    const base = ref ? this.stateOf(ref.workflowName, ref.runId, ref).state : undefined;
    return {
      workflow_name: record.workflow_name,
      run_id: record.run_id,
      resourceId: record.resourceId,
      snapshot: materializeWorkflowRun(record.header, entries, base),
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
    return record
      ? {
          header: cloneRunData(record.header),
          lastSeq: record.lastSeq,
          runToken: record.runToken,
          startStateSeq: record.startStateSeq,
        }
      : null;
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

    const latest: Map<string, any> = latestStepResults(this.db.workflowRunEntries.get(key) ?? []);
    const { state, statePatchBytes } = this.stateOf(workflowName, runId);

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
      runToken: record.runToken,
      startStateSeq: record.startStateSeq,
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
    expectedLastSeq,
    expectedRunToken,
  }: {
    workflowName: string;
    runId: string;
    stepIds: string[];
    expectedLastSeq?: number;
    expectedRunToken?: string;
  }): Promise<Record<string, StepResult<any, any, any, any>> | null> {
    const key = this.getWorkflowKey(workflowName, runId);
    const record = this.db.workflowRunHeaders.get(key);
    if (
      !record ||
      (expectedLastSeq !== undefined && record.lastSeq !== expectedLastSeq) ||
      (expectedRunToken !== undefined && record.runToken !== expectedRunToken)
    )
      return null;
    const entries = this.db.workflowRunEntries.get(key) ?? [];
    const steps = Object.fromEntries(latestStepResults(entries, new Set(stepIds)));
    return cloneRunData(steps as Record<string, StepResult<any, any, any, any>>);
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
    return {
      header: cloneRunData(record.header),
      lastSeq: record.lastSeq,
      runToken: record.runToken,
      startStateSeq: record.startStateSeq,
    };
  }

  async writeWorkflowRunCheckpoint(args: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    header: WorkflowRunHeader;
    steps: Record<string, StepResult<any, any, any, any>>;
    state?: Record<string, any>;
    stateBase?: StateRef;
    statePatch?: StatePatchOp[];
    fence?: RunFence;
    expectedStatus?: WorkflowRunStatus | WorkflowRunStatus[];
  }): Promise<{ lastSeq: number; runToken?: string } | null> {
    this.assertFence(args.fence, args.runId, 'writeWorkflowRunCheckpoint');
    return this.writeRunEntries({ ...args, append: false });
  }

  async appendWorkflowRunEntries(args: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    header: WorkflowRunHeader;
    steps: Record<string, StepResult<any, any, any, any>>;
    stepPatches?: Record<string, StatePatchOp[]>;
    state?: Record<string, any>;
    statePatch?: StatePatchOp[];
    startStateSeq?: number;
    fence?: RunFence;
    expectedStatus?: WorkflowRunStatus | WorkflowRunStatus[];
  }): Promise<{ lastSeq: number; runToken?: string } | null> {
    this.assertFence(args.fence, args.runId, 'appendWorkflowRunEntries');
    return this.writeRunEntries({ ...args, append: true });
  }

  async loadWorkflowRunState({
    workflowName,
    runId,
    seq,
  }: {
    workflowName: string;
    runId: string;
    seq: number;
  }): Promise<Record<string, any> | null> {
    if (!this.db.workflowRunHeaders.has(this.getWorkflowKey(workflowName, runId))) return null;
    return cloneRunData(this.stateOf(workflowName, runId, { seq }).state);
  }

  async appendWorkflowRunStateDraft(
    args: { workflowName: string; runId: string } & (
      | { on: StateVersion; ops: StatePatchOp[] }
      | { state: Record<string, any> }
    ),
  ): Promise<{ seq: number }> {
    this.assertFence(undefined, args.runId, 'appendWorkflowRunStateDraft');
    const key = this.getWorkflowKey(args.workflowName, args.runId);
    const record = this.db.workflowRunHeaders.get(key);
    if (!record) throw new Error(`Storage v2 run ${args.workflowName}/${args.runId} is not stored`);
    const seq = ++record.lastSeq;
    record.stateShared = true;
    const entries = this.db.workflowRunEntries.get(key) ?? [];
    entries.push(
      'state' in args
        ? { seq, kind: 'state-draft', state: cloneRunData(args.state) }
        : { seq, kind: 'state-draft', on: { ...args.on }, ops: cloneRunData(args.ops) },
    );
    this.db.workflowRunEntries.set(key, entries);
    return { seq };
  }

  supportsLeafAdoption(): boolean {
    return true;
  }

  private leafRecords(workflowName: string, runId: string): Map<string, unknown> {
    const key = this.getWorkflowKey(workflowName, runId);
    let records = this.db.workflowLeafRecords.get(key);
    if (!records) {
      records = new Map();
      this.db.workflowLeafRecords.set(key, records);
    }
    return records;
  }

  async putWorkflowLeafRecord<T>({
    workflowName,
    runId,
    kind,
    key,
    payload,
  }: {
    workflowName: string;
    runId: string;
    kind: Exclude<WorkflowLeafRecordKind, 'adoption'>;
    key: string;
    payload: T;
  }): Promise<{ payload: T; created: boolean }> {
    const records = this.leafRecords(workflowName, runId);
    const recordKey = `${kind}:${key}`;
    if (records.has(recordKey)) return { payload: cloneRunData(records.get(recordKey) as T), created: false };
    records.set(recordKey, cloneRunData(payload));
    return { payload, created: true };
  }

  async loadWorkflowLeafRecord<T>({
    workflowName,
    runId,
    kind,
    key,
  }: {
    workflowName: string;
    runId: string;
    kind: WorkflowLeafRecordKind;
    key: string;
  }): Promise<T | null> {
    const record = this.db.workflowLeafRecords.get(this.getWorkflowKey(workflowName, runId))?.get(`${kind}:${key}`);
    return record === undefined ? null : cloneRunData(record as T);
  }

  async adoptWorkflowLeaf({
    workflowName,
    runId,
    occurrenceKey,
    candidateId,
    steps = {},
    statePatch,
    expectedStatus,
    fence,
  }: AdoptWorkflowLeafArgs): Promise<AdoptWorkflowLeafResult | null> {
    this.assertFence(fence, runId, 'adoptWorkflowLeaf');
    const records = this.leafRecords(workflowName, runId);
    const recordKey = `adoption:${occurrenceKey}`;
    const stored = records.get(recordKey) as WorkflowLeafAdoptionReceipt | undefined;
    if (stored) {
      if (stored.candidateId !== candidateId) {
        throw new LeafAdoptionConflictError(occurrenceKey, stored.candidateId, candidateId);
      }
      return { receipt: cloneRunData(stored), adopted: false };
    }
    const record = this.db.workflowRunHeaders.get(this.getWorkflowKey(workflowName, runId));
    if (!record) throw new Error(`Storage v2 run ${workflowName}/${runId} is not stored`);
    if (!matchesExpectedWorkflowStatus(record.header.status, expectedStatus)) return null;
    const { lastSeq } = this.writeRunEntries({
      workflowName,
      runId,
      header: record.header,
      steps,
      statePatch: statePatch?.length ? statePatch : undefined,
      append: true,
    })!;
    const receipt: WorkflowLeafAdoptionReceipt = { v: 1, occurrenceKey, candidateId, seq: lastSeq };
    records.set(recordKey, receipt);
    return { receipt: cloneRunData(receipt), adopted: true };
  }

  /**
   * Writes the header and one entry per step and step patch, then the state, state base or state
   * patch. A checkpoint first drops the old step entries and starts the state over (`{}` when it
   * carries none). It drops the old state entries too, unless another run's state builds on this
   * run's (`stateShared`), which can name an earlier version. Writes nothing, returning null, when
   * the stored run's status doesn't match `expectedStatus`, and throws when the state base isn't stored.
   */
  private writeRunEntries({
    workflowName,
    runId,
    resourceId,
    header,
    steps,
    stepPatches,
    state,
    stateBase,
    statePatch,
    startStateSeq,
    expectedStatus,
    append,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    header: WorkflowRunHeader;
    steps: Record<string, StepResult<any, any, any, any>>;
    stepPatches?: Record<string, StatePatchOp[]>;
    state?: Record<string, any>;
    stateBase?: StateRef;
    statePatch?: StatePatchOp[];
    startStateSeq?: number;
    expectedStatus?: WorkflowRunStatus | WorkflowRunStatus[];
    append: boolean;
  }): { lastSeq: number; runToken: string } | null {
    const key = this.getWorkflowKey(workflowName, runId);
    const existing = this.db.workflowRunHeaders.get(key);
    if (existing && !matchesExpectedWorkflowStatus(existing.header.status, expectedStatus)) return null;
    if (state === undefined && stateBase !== undefined && !this.hasStateVersion(stateBase)) {
      throw new Error(
        `Workflow run ${workflowName}/${runId} builds on state version ${stateBase.seq} of ${stateBase.workflowName}/${stateBase.runId}, which is not stored`,
      );
    }
    const now = new Date();
    let seq = existing?.lastSeq ?? 0;
    const previous = this.db.workflowRunEntries.get(key) ?? [];
    const entries: WorkflowRunEntry[] = append
      ? previous
      : existing?.stateShared
        ? previous.filter(entry => entry.kind !== 'step' && entry.kind !== 'step-patch')
        : [];
    for (const [stepId, result] of Object.entries(steps)) {
      entries.push({ seq: ++seq, kind: 'step', stepId, result: cloneRunData(result) });
    }
    for (const [stepId, ops] of Object.entries(stepPatches ?? {})) {
      entries.push({ seq: ++seq, kind: 'step-patch', stepId, ops: cloneRunData(ops) });
    }
    if (state !== undefined) {
      entries.push({ seq: ++seq, kind: 'state', state: cloneRunData(state) });
    } else if (stateBase !== undefined) {
      entries.push({ seq: ++seq, kind: 'state-base', base: { ...stateBase } });
      const base = this.db.workflowRunHeaders.get(this.getWorkflowKey(stateBase.workflowName, stateBase.runId));
      if (base) base.stateShared = true;
    } else if (!append) {
      entries.push({ seq: ++seq, kind: 'state', state: {} });
    }
    if (state === undefined && statePatch !== undefined) {
      entries.push({ seq: ++seq, kind: 'state-patch', ops: cloneRunData(statePatch) });
    }
    const runToken = existing?.runToken ?? randomUUID();
    this.db.workflowRunHeaders.set(key, {
      workflow_name: workflowName,
      run_id: runId,
      resourceId: resourceId ?? existing?.resourceId,
      header: cloneRunData(header),
      lastSeq: seq,
      runToken,
      // A checkpoint's state entries come last, so its start state is the state as of its last entry.
      startStateSeq: append ? (startStateSeq ?? existing?.startStateSeq ?? 0) : seq,
      stateShared: existing?.stateShared,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    this.db.workflowRunEntries.set(key, entries);
    return { lastSeq: seq, runToken };
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot,
    createdAt,
    updatedAt,
    fence,
    expectedStatus,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
    fence?: RunFence;
    expectedStatus?: WorkflowRunStatus | WorkflowRunStatus[];
  }): Promise<boolean> {
    this.assertFence(fence, runId, 'persistWorkflowSnapshot');
    const key = this.getWorkflowKey(workflowName, runId);
    const now = new Date();
    const existing = this.db.workflows.get(key);
    if (existing?.snapshot && !matchesExpectedWorkflowStatus(this.snapshotStatus(existing), expectedStatus)) {
      return false;
    }
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
    return true;
  }

  async loadWorkflowRunStatus({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunStatus | null> {
    const key = this.getWorkflowKey(workflowName, runId);
    // Looks in both stores, storage v2 first, as `loadWorkflowSnapshot` does.
    const record = this.db.workflowRunHeaders.get(key);
    if (record) return record.header.status ?? null;
    const run = this.db.workflows.get(key);
    return run?.snapshot ? (this.snapshotStatus(run) ?? null) : null;
  }

  private snapshotStatus(run: StorageWorkflowRun): WorkflowRunStatus | undefined {
    const snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;
    return snapshot?.status;
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
    storageVersion,
    fence,
  }: {
    runId: string;
    workflowName: string;
    storageVersion?: 1 | 2;
    fence?: RunFence;
  }): Promise<void> {
    this.assertFence(fence, runId, 'deleteWorkflowRunById');
    const key = this.getWorkflowKey(workflowName, runId);
    if (storageVersion !== 2) this.db.workflows.delete(key);
    if (storageVersion === 1) return;
    this.detachStateChildren(workflowName, runId);
    this.db.workflowRunHeaders.delete(key);
    this.db.workflowRunEntries.delete(key);
    this.db.workflowLeafRecords.delete(key);
  }
}
