import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { Memory } from './index';
import { updateWorkingMemoryTool } from './tools/working-memory';
import { z } from 'zod';

const createMemory = () =>
  new Memory({ storage: new InMemoryStore(), options: { workingMemory: { enabled: true, scope: 'resource' } } });
describe('atomic working-memory merge', () => {
  it('fails explicitly on unsupported storage, while replacement still works', async () => {
    const memory = createMemory();
    expect(await memory.supportsAtomicWorkingMemoryUpdates()).toBe(false);
    await expect(
      memory.updateWorkingMemory({ threadId: 't', resourceId: 'r', workingMemory: '{}', mode: 'merge' }),
    ).rejects.toThrow('supporting storage');
    await memory.updateWorkingMemory({ threadId: 't', resourceId: 'r', workingMemory: '{"keep":true}' });
    expect(await memory.getWorkingMemory({ threadId: 't', resourceId: 'r' })).toBe('{"keep":true}');
  });

  it('merges against the value supplied inside storage and rejects corrupt data', async () => {
    const memory = createMemory();
    let raw = '{"tone":"new","name":"old","nested":{"keep":true}}';
    const mutateResourceWorkingMemory = vi.fn(async ({ update }) => {
      raw = update(raw);
    });
    vi.spyOn(memory as any, 'getMemoryStore').mockResolvedValue({ mutateResourceWorkingMemory });
    await memory.updateWorkingMemory({
      threadId: 't',
      resourceId: 'r',
      mode: 'merge',
      workingMemory: '{"name":null,"nested":{"added":true}}',
    });
    expect(JSON.parse(raw)).toEqual({ tone: 'new', nested: { keep: true, added: true } });
    for (const invalid of ['[]', 'null', '"text"', 'bad']) {
      await expect(
        memory.updateWorkingMemory({ threadId: 't', resourceId: 'r', mode: 'merge', workingMemory: invalid }),
      ).rejects.toThrow();
    }
    expect(mutateResourceWorkingMemory).toHaveBeenCalledTimes(1);
    raw = 'not JSON';
    await expect(
      memory.updateWorkingMemory({ threadId: 't', resourceId: 'r', mode: 'merge', workingMemory: '{}' }),
    ).rejects.toThrow();
    expect(raw).toBe('not JSON');
  });

  it('sends only changed fields from the schema tool and never reads a stale snapshot', async () => {
    const memory = {
      supportsAtomicWorkingMemoryUpdates: vi.fn(async () => true),
      updateWorkingMemory: vi.fn(),
      getWorkingMemory: vi.fn(),
    };
    const tool = updateWorkingMemoryTool({
      workingMemory: { enabled: true, scope: 'resource', schema: z.object({ name: z.string().optional() }) },
    });
    await tool.execute!({ memory: { name: 'Fad' } }, { memory, agent: { resourceId: 'r' } } as any);
    expect(memory.getWorkingMemory).not.toHaveBeenCalled();
    expect(memory.updateWorkingMemory).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'r', mode: 'merge', workingMemory: '{"name":"Fad"}' }),
    );
  });
});
