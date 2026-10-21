import { safeStringify } from '../../../utils/safe-stringify';
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

class SerializingWorkflows extends WorkflowsInMemory {
  override updateWorkflowResults(args: Parameters<WorkflowsInMemory['updateWorkflowResults']>[0]) {
    const { result, state, requestContext, ...control } = args;
    return super.updateWorkflowResults({
      ...control,
      ...JSON.parse(safeStringify({ result, state, requestContext })),
    });
  }

  override updateWorkflowState(args: Parameters<WorkflowsInMemory['updateWorkflowState']>[0]) {
    const { opts, ...control } = args;
    const { expectedStatus, ...values } = opts;
    return super.updateWorkflowState({
      ...control,
      opts: { ...JSON.parse(safeStringify(values)), expectedStatus },
    });
  }
}

// Test-only persistence boundary. Other domains retain ordinary in-memory behavior.
export function createSerializingStore(onWrite?: (rows: SerializedWorkflowRow[]) => void) {
  const db = new SerializingDB(onWrite);
  const store = new InMemoryStore();
  store.stores.workflows = new SerializingWorkflows({ db });
  return { store, inspect: () => db.workflows.inspect() };
}
