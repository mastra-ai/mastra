import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { WorkingMemoryExtractor } from './processors/observational-memory/working-memory-extractor';
import { updateWorkingMemoryTool } from './tools/working-memory';
import { Memory } from './index';

const schema = z.object({ name: z.string().optional(), tone: z.string().optional(), city: z.string().optional() });
const memoryConfig = { workingMemory: { enabled: true, schema, scope: 'resource' as const } };

const createMemory = (options: Record<string, unknown> = memoryConfig) =>
  new Memory({ storage: new InMemoryStore(), options: options as any });

/** Gives the in-memory adapter an atomic merge so the Memory-level logic can be exercised. */
async function enableAtomicMerge(memory: Memory) {
  const store = (await (memory as any).getMemoryStore()) as MemoryStorage;
  Object.defineProperty(store, 'supportsAtomicWorkingMemoryMerge', { value: true });
  // Serialized like the row lock in @mastra/pg, so concurrent merges never read the same snapshot.
  let lock: Promise<unknown> = Promise.resolve();
  const merge = vi.fn(({ resourceId, merge }: { resourceId: string; merge: (e?: string) => string }) => {
    const run = lock.then(async () => {
      const existing = await store.getResourceById({ resourceId });
      return store.updateResource({ resourceId, workingMemory: merge(existing?.workingMemory ?? undefined) });
    });
    lock = run.catch(() => undefined);
    return run;
  });
  store.mergeResourceWorkingMemory = merge;
  return { store, merge };
}

describe('Memory.mergeWorkingMemory', () => {
  it('rejects adapters without atomic merge support instead of silently replacing', async () => {
    const memory = createMemory();
    expect(await memory.supportsAtomicWorkingMemoryMerge()).toBe(false);
    await expect(
      memory.mergeWorkingMemory({ threadId: 't', resourceId: 'r', workingMemory: { name: 'A' } }),
    ).rejects.toThrow(/not supported by this storage adapter/);
  });

  it('deep-merges into existing working memory through the storage merge', async () => {
    const memory = createMemory();
    const { store, merge } = await enableAtomicMerge(memory);
    await store.updateResource({ resourceId: 'r', workingMemory: JSON.stringify({ name: 'A', tone: 'calm' }) });

    await memory.mergeWorkingMemory({ threadId: 't', resourceId: 'r', workingMemory: '{"city":"Oslo","tone":null}' });

    expect(merge).toHaveBeenCalledOnce();
    const resource = await store.getResourceById({ resourceId: 'r' });
    expect(JSON.parse(resource!.workingMemory!)).toEqual({ name: 'A', city: 'Oslo' });
  });

  it('replaces stored working memory that is not a JSON object', async () => {
    const memory = createMemory();
    const { store } = await enableAtomicMerge(memory);
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
    const { store, merge } = await enableAtomicMerge(memory);
    await store.updateResource({ resourceId: 'r', workingMemory: JSON.stringify({ name: 'A' }) });

    expect(await runTool(memory, { tone: 'warm' })).toEqual({ success: true });

    expect(merge).toHaveBeenCalledOnce();
    const resource = await store.getResourceById({ resourceId: 'r' });
    expect(JSON.parse(resource!.workingMemory!)).toEqual({ name: 'A', tone: 'warm' });
  });

  it('falls back to read-merge-write when the adapter lacks atomic merge', async () => {
    const memory = createMemory();
    const store = (await (memory as any).getMemoryStore()) as MemoryStorage;
    await store.updateResource({ resourceId: 'r', workingMemory: JSON.stringify({ name: 'A' }) });

    expect(await runTool(memory, { tone: 'warm' })).toEqual({ success: true });

    const resource = await store.getResourceById({ resourceId: 'r' });
    expect(JSON.parse(resource!.workingMemory!)).toEqual({ name: 'A', tone: 'warm' });
  });
});

describe('OM working memory extractor with resource-scoped schema working memory (#28993)', () => {
  const requiredSchema = z.object({ name: z.string(), tone: z.string().optional(), city: z.string().optional() });
  const runExtractor = (memory: Memory, patch: unknown, threadId = 'thread-1') =>
    new WorkingMemoryExtractor().onExtracted!({ current: patch, memory, threadId, resourceId: 'r' } as any);
  const readWorkingMemory = async (memory: Memory) => {
    const store = (await (memory as any).getMemoryStore()) as MemoryStorage;
    const resource = await store.getResourceById({ resourceId: 'r' });
    return JSON.parse(resource!.workingMemory!);
  };

  it('keeps fields saved by a sibling thread while its own patch is being extracted', async () => {
    const memory = createMemory();
    const { store, merge } = await enableAtomicMerge(memory);
    await store.updateResource({ resourceId: 'r', workingMemory: JSON.stringify({ name: 'A' }) });

    await Promise.all([
      runExtractor(memory, { tone: 'warm' }, 'thread-a'),
      runExtractor(memory, { city: 'Oslo' }, 'thread-b'),
    ]);

    expect(merge).toHaveBeenCalledTimes(2);
    expect(await readWorkingMemory(memory)).toEqual({ name: 'A', tone: 'warm', city: 'Oslo' });
  });

  it('deletes fields set to null', async () => {
    const memory = createMemory();
    const { store } = await enableAtomicMerge(memory);
    await store.updateResource({ resourceId: 'r', workingMemory: JSON.stringify({ name: 'A', tone: 'calm' }) });

    await runExtractor(memory, { tone: null, city: 'Oslo' });

    expect(await readWorkingMemory(memory)).toEqual({ name: 'A', city: 'Oslo' });
  });

  it('merges with read-merge-write when the adapter lacks atomic merge', async () => {
    const memory = createMemory();
    const store = (await (memory as any).getMemoryStore()) as MemoryStorage;
    await store.updateResource({ resourceId: 'r', workingMemory: JSON.stringify({ name: 'A', tone: 'calm' }) });

    await expect(runExtractor(memory, { city: 'Oslo' })).resolves.toEqual({ city: 'Oslo' });

    expect(await readWorkingMemory(memory)).toEqual({ name: 'A', tone: 'calm', city: 'Oslo' });
  });

  it('serializes concurrent read-merge-writes when the adapter lacks atomic merge', async () => {
    const memory = createMemory();
    const store = (await (memory as any).getMemoryStore()) as MemoryStorage;
    await store.updateResource({ resourceId: 'r', workingMemory: JSON.stringify({ name: 'A' }) });

    await Promise.all([
      runExtractor(memory, { tone: 'warm' }, 'thread-a'),
      runExtractor(memory, { city: 'Oslo' }, 'thread-b'),
    ]);

    expect(await readWorkingMemory(memory)).toEqual({ name: 'A', tone: 'warm', city: 'Oslo' });
  });

  it('validates the merged document, so a patch may omit required fields that are already stored', async () => {
    const memory = createMemory({ workingMemory: { enabled: true, schema: requiredSchema, scope: 'resource' } });
    const { store } = await enableAtomicMerge(memory);
    await store.updateResource({ resourceId: 'r', workingMemory: JSON.stringify({ name: 'A' }) });

    await runExtractor(memory, { tone: 'warm' });

    expect(await readWorkingMemory(memory)).toEqual({ name: 'A', tone: 'warm' });
  });

  it.each([
    ['deletes a required field', { name: null }, 'name'],
    ['sets a field to the wrong type', { tone: 5 }, 'tone'],
  ])('does not save a patch that %s', async (_label, patch, invalidField) => {
    const memory = createMemory({ workingMemory: { enabled: true, schema: requiredSchema, scope: 'resource' } });
    const { store, merge } = await enableAtomicMerge(memory);
    await store.updateResource({ resourceId: 'r', workingMemory: JSON.stringify({ name: 'A' }) });

    await expect(runExtractor(memory, patch)).rejects.toThrow(
      new RegExp(`does not match the configured schema.*${invalidField}`),
    );

    expect(merge).not.toHaveBeenCalled();
    expect(await readWorkingMemory(memory)).toEqual({ name: 'A' });
  });

  it.each([
    ['null', null],
    ['an empty object', {}],
  ])('does not touch working memory when the patch is %s', async (_label, patch) => {
    const memory = createMemory();
    const { store, merge } = await enableAtomicMerge(memory);
    await store.updateResource({ resourceId: 'r', workingMemory: JSON.stringify({ name: 'A' }) });

    await expect(runExtractor(memory, patch)).resolves.toBeUndefined();

    expect(merge).not.toHaveBeenCalled();
    expect(await readWorkingMemory(memory)).toEqual({ name: 'A' });
  });
});
