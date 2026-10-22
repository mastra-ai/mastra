import { RUN_FENCE_CONFLICT_ERROR_ID, RunFenceConflictError } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { ConvexAdminClient } from './client';
import { assertRunFence, fencedCaller } from './run-fencing';

const check = {
  claims: 'mastra_workflow_run_owners' as const,
  fence: { runId: 'run-1', generation: 3, ownerId: 'a' },
  operation: 'saveMessages',
};

function clientRejecting(error: unknown) {
  return { callStorageRaw: vi.fn(async () => Promise.reject(error)) } as unknown as ConvexAdminClient;
}

describe('Convex fenced caller', () => {
  it('wraps writes in a fenced request and leaves reads unfenced', async () => {
    const callStorageRaw = vi.fn(async () => ({ result: 'ok' }));
    const caller = fencedCaller({ callStorageRaw } as unknown as ConvexAdminClient, {
      ...check,
      fence: { ...check.fence, extra: 'dropped' } as any,
    });

    await caller.callStorage({ op: 'load', tableName: 'mastra_messages', keys: { id: 'm1' } } as any);
    expect(callStorageRaw).toHaveBeenLastCalledWith(expect.objectContaining({ op: 'load' }));

    const write = { op: 'insert', tableName: 'mastra_messages', record: { id: 'm1' } } as any;
    await caller.callStorage(write);
    expect(callStorageRaw).toHaveBeenLastCalledWith({
      op: 'fenced',
      tableName: check.claims,
      fence: { runId: 'run-1', generation: 3, ownerId: 'a' },
      request: write,
    });
  });

  it('maps STORAGE_RUN_FENCE_CONFLICT to RunFenceConflictError', async () => {
    const error = Object.assign(new Error('conflict'), { code: RUN_FENCE_CONFLICT_ERROR_ID });
    const caller = fencedCaller(clientRejecting(error), check);
    await expect(caller.callStorage({ op: 'insert', tableName: 'x', record: {} } as any)).rejects.toBeInstanceOf(
      RunFenceConflictError,
    );
    await expect(assertRunFence(clientRejecting(error), check)).rejects.toBeInstanceOf(RunFenceConflictError);
  });

  it('explains a deployment without run fencing support', async () => {
    const caller = fencedCaller(clientRejecting(new Error('Unsupported operation fenced')), check);
    await expect(caller.callStorage({ op: 'insert', tableName: 'x', record: {} } as any)).rejects.toThrow(
      /Redeploy your Convex functions/,
    );
  });
});
