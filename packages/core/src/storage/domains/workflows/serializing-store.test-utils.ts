import { InMemoryStore } from '../../mock';
import type { StorageWorkflowRun } from '../../types';
import { InMemoryDB } from '../inmemory-db';
import { WorkflowsInMemory } from './inmemory';

export type SerializedWorkflowRow = {
  workflowName: string;
  runId: string;
  resourceId?: string;
  snapshot: string;
  snapshotBytes: number;
};

class SerializingWorkflowRows extends Map<string, StorageWorkflowRun> {
  constructor(private readonly onWrite?: (rows: SerializedWorkflowRow[]) => void) {
    super();
  }

  override set(key: string, row: StorageWorkflowRun) {
    // Existing string snapshots are already JSON, not JSON string literals.
    const snapshot = typeof row.snapshot === 'string' ? row.snapshot : safeStringify(row.snapshot);
    super.set(key, { ...row, snapshot });
    this.onWrite?.(this.inspect());
    return this;
  }

  inspect(): SerializedWorkflowRow[] {
    return Array.from(this.values(), row => {
      if (typeof row.snapshot !== 'string') throw new Error('Expected a stored JSON snapshot');
      return {
        workflowName: row.workflow_name,
        runId: row.run_id,
        resourceId: row.resourceId,
        snapshot: row.snapshot,
        snapshotBytes: Buffer.byteLength(row.snapshot, 'utf8'),
      };
    });
  }
}

class SerializingDB extends InMemoryDB {
  override readonly workflows: SerializingWorkflowRows;

  constructor(onWrite?: (rows: SerializedWorkflowRow[]) => void) {
    super();
    this.workflows = new SerializingWorkflowRows(onWrite);
  }
}

// Mirrors stores/libsql/src/storage/db/utils.ts without adding an adapter dependency.
// Keep the depth, cycle, proxy and toJSON semantics aligned with that sanitizer.
function safeStringify(value: unknown): string {
  const ancestors = new Set<object>();
  const sanitize = (val: unknown, depth = 0): unknown => {
    if (val === null || val === undefined) return val;
    if (typeof val === 'function' || typeof val === 'symbol') return undefined;
    if (typeof val === 'bigint') return val.toString();
    if (typeof val !== 'object') return val;
    if (depth > 100) return '[Max depth exceeded]';
    if (ancestors.has(val)) return undefined;
    try {
      (val as Record<string, unknown>).toJSON;
      Object.keys(val);
    } catch {
      return undefined;
    }
    if (typeof (val as Record<string, unknown>).toJSON === 'function') {
      return sanitize((val as { toJSON: () => unknown }).toJSON(), depth + 1);
    }
    ancestors.add(val);
    try {
      if (Array.isArray(val)) return val.map(item => sanitize(item, depth + 1));
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(val)) {
        const sanitized = sanitize((val as Record<string, unknown>)[key], depth + 1);
        if (sanitized !== undefined) result[key] = sanitized;
      }
      return result;
    } finally {
      ancestors.delete(val);
    }
  };
  return JSON.stringify(sanitize(value)) ?? 'null';
}

// Test-only persistence boundary. Other domains retain ordinary in-memory behavior.
export function createSerializingStore(onWrite?: (rows: SerializedWorkflowRow[]) => void) {
  const db = new SerializingDB(onWrite);
  const store = new InMemoryStore();
  store.stores.workflows = new WorkflowsInMemory({ db });
  return { store, inspect: () => db.workflows.inspect() };
}
