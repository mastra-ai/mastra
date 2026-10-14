import { TABLE_MEMORY_RUN_FENCES, TABLE_WORKFLOW_RUN_OWNERS } from '@mastra/core/storage';
import { GlideClient } from '@valkey/valkey-glide';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRunFencingTests } from '../../../_test-utils/src/domains/run-fencing';
import { RUN_CLAIM_RETENTION_MS, runClaimKey } from './domains/run-fencing';
import { ValkeyStore } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

describe('Valkey run fencing', () => {
  const store = new ValkeyStore({
    id: 'valkey-run-fencing',
    host: 'localhost',
    port: 6382,
    password: 'valkey_password',
  });

  beforeAll(() => store.init());
  afterAll(() => store.close());

  it('declares fencing', async () => {
    expect((await store.getStore('workflows'))?.supportsRunFencing()).toBe(true);
    expect((await store.getStore('memory'))?.supportsRunFencing()).toBe(true);
  });

  it('expires released claims and retired fences, but not active ones', async () => {
    const client = await GlideClient.createClient({
      addresses: [{ host: 'localhost', port: 6382 }],
      credentials: { password: 'valkey_password' },
    });
    try {
      const workflows = (await store.getStore('workflows'))!;
      const memory = (await store.getStore('memory'))!;
      const runId = `retention-${Date.now()}`;
      const claimKey = runClaimKey(TABLE_WORKFLOW_RUN_OWNERS, runId);
      const fenceKey = runClaimKey(TABLE_MEMORY_RUN_FENCES, runId);

      const first = await workflows.claimRunOwnership({ runId, ownerId: 'a', leaseMs: 30_000 });
      expect(await client.pttl(claimKey)).toBe(-1);
      await workflows.releaseRunOwnership({ runId, generation: first.record!.generation, ownerId: 'a' });
      expect(await client.pttl(claimKey)).toBeGreaterThan(RUN_CLAIM_RETENTION_MS - 60_000);
      const second = await workflows.claimRunOwnership({ runId, ownerId: 'b', leaseMs: 30_000 });
      expect(await client.pttl(claimKey)).toBe(-1);

      const fence = { runId, generation: second.record!.generation, ownerId: 'b' };
      await memory.raiseRunFence(fence);
      expect(await client.pttl(fenceKey)).toBe(-1);
      await memory.retireRunFence(fence);
      expect(await client.pttl(fenceKey)).toBeGreaterThan(RUN_CLAIM_RETENTION_MS - 60_000);
      await memory.raiseRunFence(fence);
      expect(await client.pttl(fenceKey)).toBe(-1);
    } finally {
      client.close();
    }
  });

  createRunFencingTests({ storage: store });
});
