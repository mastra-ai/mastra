import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { updateWorkingMemoryTool } from './tools/working-memory';
import { Memory } from './index';

const schema = z.object({ name: z.string().optional(), tone: z.string().optional(), city: z.string().optional() });
const memoryConfig = { workingMemory: { enabled: true, schema, scope: 'resource' as const } };

const createMemory = (options: Record<string, unknown> = memoryConfig) =>
  new Memory({ storage: new InMemoryStore(), options: options as any });

/** Spies on the in-memory adapter's atomic merge. */
async function spyOnAtomicMerge(memory: Memory) {
  const store = (await (memory as any).getMemoryStore()) as MemoryStorage;
  const merge = vi.spyOn(store, 'mergeResourceWorkingMemory');
  return { store, merge };
}

/** Makes the in-memory adapter report no atomic merge, like adapters that don't implement it. */
async function disableAtomicMerge(memory: Memory) {
  const store = (await (memory as any).getMemoryStore()) as MemoryStorage;
  Object.defineProperty(store, 'supportsAtomicWorkingMemoryMerge', { value: false });
  return store;
}

describe('Memory.mergeWorkingMemory', () => {
  it('rejects adapters without atomic merge support instead of silently replacing', async () => {
    const memory = createMemory();
    await disableAtomicMerge(memory);
    expect(await memory.supportsAtomicWorkingMemoryMerge()).toBe(false);
    await expect(
      memory.mergeWorkingMemory({ threadId: 't', resourceId: 'r', workingMemory: { name: 'A' } }),
    ).rejects.toThrow(/not supported by this storage adapter/);
  });

  it('deep-merges into existing working memory through the storage merge', async () => {
    const memory = createMemory();
    const { store, merge } = await spyOnAtomicMerge(memory);
    await store.updateResource({ resourceId: 'r', workingMemory: JSON.stringify({ name: 'A', tone: 'calm' }) });

    await memory.mergeWorkingMemory({ threadId: 't', resourceId: 'r', workingMemory: '{"city":"Oslo","tone":null}' });

    expect(merge).toHaveBeenCalledOnce();
    const resource = await store.getResourceById({ resourceId: 'r' });
    expect(JSON.parse(resource!.workingMemory!)).toEqual({ name: 'A', city: 'Oslo' });
  });

  it('replaces stored working memory that is not a JSON object', async () => {
    const memory = createMemory();
    const { store } = await spyOnAtomicMerge(memory);
    await store.updateResource({ resourceId: 'r', workingMemory: '["stale"]' });

    await memory.mergeWorkingMemory({ threadId: 't', resourceId: 'r', workingMemory: '{"city":"Oslo"}' });

    const resource = await store.getResourceById({ resourceId: 'r' });
    expect(JSON.parse(resource!.workingMemory!)).toEqual({ city: 'Oslo' });
  });

  it('requires schema-based, resource-scoped working memory and an object patch', async () => {
    await expect(
      createMemory({ workingMemory: { enabled: true } }).mergeWorkingMemory({
        threadId: 't',
        resourceId: 'r',
        workingMemory: {},
      }),
    ).rejects.toThrow(/schema-based/);
    await expect(
      createMemory({ workingMemory: { enabled: true, schema, scope: 'thread' } }).mergeWorkingMemory({
        threadId: 't',
        resourceId: 'r',
        workingMemory: {},
      }),
    ).rejects.toThrow(/resource-scoped/);
    await expect(
      createMemory().mergeWorkingMemory({ threadId: 't', resourceId: 'r', workingMemory: '[1]' }),
    ).rejects.toThrow(/JSON object/);
  });
});

describe('update-working-memory tool with schema', () => {
  const runTool = (memory: Memory, input: unknown) =>
    (updateWorkingMemoryTool(memoryConfig as any) as any).execute(
      { memory: input },
      { memory, agent: { threadId: 'thread-1', resourceId: 'r' } },
    );

  it('uses the atomic storage merge when the adapter supports it', async () => {
    const memory = createMemory();
    const { store, merge } = await spyOnAtomicMerge(memory);
    await store.updateResource({ resourceId: 'r', workingMemory: JSON.stringify({ name: 'A' }) });

    expect(await runTool(memory, { tone: 'warm' })).toEqual({ success: true });

    expect(merge).toHaveBeenCalledOnce();
    const resource = await store.getResourceById({ resourceId: 'r' });
    expect(JSON.parse(resource!.workingMemory!)).toEqual({ name: 'A', tone: 'warm' });
  });

  it('falls back to read-merge-write when the adapter lacks atomic merge', async () => {
    const memory = createMemory();
    const store = await disableAtomicMerge(memory);
    await store.updateResource({ resourceId: 'r', workingMemory: JSON.stringify({ name: 'A' }) });

    expect(await runTool(memory, { tone: 'warm' })).toEqual({ success: true });

    const resource = await store.getResourceById({ resourceId: 'r' });
    expect(JSON.parse(resource!.workingMemory!)).toEqual({ name: 'A', tone: 'warm' });
  });
});
