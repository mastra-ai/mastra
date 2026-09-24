import type { Json } from '../protocol.js';
import { RenderRunConflictError } from '../errors.js';

export type RunStatus =
  'submitting' | 'submission-unknown' | 'pending' | 'running' | 'cancel-requested' | 'success' | 'failed' | 'canceled';
export interface RunRecord {
  workflowId: string;
  runId: string;
  resourceId?: string;
  buildId: string;
  manifest: string;
  revision: number;
  status: RunStatus;
  providerId?: string;
  workerClaim?: string;
  input: Json;
  initialState: Json;
  result?: Json;
  error?: { name: string; message: string };
  createdAt: number;
  updatedAt: number;
}

export interface RenderPersistence {
  readonly durable: boolean;
  create(record: RunRecord): Promise<boolean>;
  get(workflowId: string, runId: string): Promise<RunRecord | null>;
  compareAndSwap(record: RunRecord, expectedRevision: number): Promise<boolean>;
  close(): Promise<void>;
}

export const terminal = (status: RunStatus) => status === 'success' || status === 'failed' || status === 'canceled';

export async function updateRun(
  store: RenderPersistence,
  workflowId: string,
  runId: string,
  update: (current: RunRecord) => Partial<RunRecord>,
): Promise<RunRecord> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const current = await store.get(workflowId, runId);
    if (!current) throw new RenderRunConflictError(`Unknown Mastra run ${workflowId}/${runId}`);
    const patch = update(current);
    if (terminal(current.status)) return current;
    const next = { ...current, ...patch, revision: current.revision + 1, updatedAt: Date.now() };
    if (await store.compareAndSwap(next, current.revision)) return next;
  }
  throw new RenderRunConflictError(`Concurrent updates did not settle for ${workflowId}/${runId}`);
}
