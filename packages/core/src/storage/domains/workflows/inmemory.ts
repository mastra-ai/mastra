import type { StepResult, WorkflowRunState } from '../../../workflows';
import { normalizePerPage } from '../../base';
import type {
  StorageWorkflowRun,
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  UpdateWorkflowStateOptions,
} from '../../types';
import { createEmptyWorkflowSnapshot, mergeWorkflowStepResult } from '../../workflow-snapshot';
import type { InMemoryDB } from '../inmemory-db';
import { WorkflowsStorage } from './base';

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

  async dangerouslyClearAll(): Promise<void> {
    this.db.workflows.clear();
  }

  private getWorkflowKey(workflowName: string, runId: string): string {
    return `${workflowName}-${runId}`;
  }

  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    const key = this.getWorkflowKey(workflowName, runId);
    const run = this.db.workflows.get(key);

    if (!run) {
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

    const context = mergeWorkflowStepResult({ snapshot, stepId, result, requestContext });

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
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    const key = this.getWorkflowKey(workflowName, runId);
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

    snapshot = { ...snapshot, ...opts };
    this.db.workflows.set(key, {
      ...run,
      snapshot: snapshot,
    });

    return snapshot;
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot,
    createdAt,
    updatedAt,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    const key = this.getWorkflowKey(workflowName, runId);
    const now = new Date();
    const existing = this.db.workflows.get(key);
    const data: StorageWorkflowRun = {
      workflow_name: workflowName,
      run_id: runId,
      resourceId,
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
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const key = this.getWorkflowKey(workflowName, runId);
    const run = this.db.workflows.get(key);

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
    status,
  }: StorageListWorkflowRunsInput = {}): Promise<WorkflowRuns> {
    if (page !== undefined && page < 0) {
      throw new Error('page must be >= 0');
    }

    let runs = Array.from(this.db.workflows.values());

    if (workflowName) runs = runs.filter((run: any) => run.workflow_name === workflowName);
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
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    // `workflowName` is optional in the storage contract. The pg/libsql adapters
    // match by `runId` alone when it is omitted and return the most recent run
    // (ORDER BY createdAt DESC LIMIT 1), so mirror that here.
    const run = Array.from(this.db.workflows.values())
      .filter((r: any) => r.run_id === runId && (!workflowName || r.workflow_name === workflowName))
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

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    const key = this.getWorkflowKey(workflowName, runId);
    this.db.workflows.delete(key);
  }
}
