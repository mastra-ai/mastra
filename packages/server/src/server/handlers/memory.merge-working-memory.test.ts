import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateWorkingMemoryBodySchema } from '../schemas/memory';
import { UPDATE_WORKING_MEMORY_ROUTE } from './memory';

describe('UPDATE_WORKING_MEMORY_ROUTE mode', () => {
  let memory: MockMemory;
  let mastra: Mastra;

  beforeEach(async () => {
    const storage = new InMemoryStore();
    memory = new MockMemory({ storage });
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test-instructions',
      model: {} as any,
      memory,
    });
    mastra = new Mastra({ logger: false, storage, agents: { 'test-agent': agent } });
    await memory.createThread({ threadId: 'thread-1', resourceId: 'user-1' });
  });

  const call = (body: Record<string, unknown>) =>
    UPDATE_WORKING_MEMORY_ROUTE.handler({
      mastra,
      requestContext: new RequestContext(),
      agentId: 'test-agent',
      threadId: 'thread-1',
      resourceId: 'user-1',
      abortSignal: new AbortController().signal,
      ...body,
    } as any);

  it('rejects merge when memory does not support atomic merge', async () => {
    await expect(call({ workingMemory: '{"a":1}', mode: 'merge' })).rejects.toMatchObject({ status: 400 });
  });

  it('routes merge mode to mergeWorkingMemory', async () => {
    vi.spyOn(memory, 'supportsAtomicWorkingMemoryMerge').mockResolvedValue(true);
    const merge = vi.spyOn(memory, 'mergeWorkingMemory').mockResolvedValue();
    const update = vi.spyOn(memory, 'updateWorkingMemory');

    await expect(call({ workingMemory: '{"a":1}', mode: 'merge' })).resolves.toEqual({ success: true });
    expect(merge).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'thread-1', resourceId: 'user-1', workingMemory: '{"a":1}' }),
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps replace as the default', async () => {
    const merge = vi.spyOn(memory, 'mergeWorkingMemory');
    const update = vi.spyOn(memory, 'updateWorkingMemory').mockResolvedValue();

    await expect(call({ workingMemory: '# notes' })).resolves.toEqual({ success: true });
    expect(update).toHaveBeenCalled();
    expect(merge).not.toHaveBeenCalled();
  });

  it('schema requires a JSON object for merge mode', () => {
    expect(updateWorkingMemoryBodySchema.safeParse({ workingMemory: '[1]', mode: 'merge' }).success).toBe(false);
    expect(updateWorkingMemoryBodySchema.safeParse({ workingMemory: 'text', mode: 'merge' }).success).toBe(false);
    expect(updateWorkingMemoryBodySchema.safeParse({ workingMemory: '{"a":1}', mode: 'merge' }).success).toBe(true);
    expect(updateWorkingMemoryBodySchema.safeParse({ workingMemory: 'text' }).success).toBe(true);
  });
});
