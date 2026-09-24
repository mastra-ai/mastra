import type { RenderPersistence, RunRecord } from './types.js';

/** Ephemeral. Use only when every process deliberately shares this instance, or for isolated tests. */
export function createMemoryPersistence(): RenderPersistence {
  const records = new Map<string, RunRecord>();
  const key = (workflowId: string, runId: string) => JSON.stringify([workflowId, runId]);
  return {
    durable: false,
    async create(record) {
      const id = key(record.workflowId, record.runId);
      if (records.has(id)) return false;
      records.set(id, structuredClone(record));
      return true;
    },
    async get(workflowId, runId) {
      return structuredClone(records.get(key(workflowId, runId)) ?? null);
    },
    async compareAndSwap(record, expectedRevision) {
      const id = key(record.workflowId, record.runId);
      if (records.get(id)?.revision !== expectedRevision) return false;
      records.set(id, structuredClone(record));
      return true;
    },
    async close() {},
  };
}
