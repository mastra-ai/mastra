import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { Harness } from './harness';

describe('Harness cloneThread', () => {
  it('resolves dynamic memory factory before cloning', async () => {
    const cloneThread = vi.fn().mockResolvedValue({
      thread: {
        id: 'cloned-thread-id',
        resourceId: 'target-resource',
        title: 'Cloned title',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        metadata: {},
      },
      clonedMessages: [],
      messageIdMap: {},
    });

    const memoryFactory = vi.fn().mockResolvedValue({
      cloneThread,
    });

    const harness = new Harness({
      id: 'test-harness',
      resourceId: 'harness-resource',
      memory: memoryFactory as any,
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: new Agent({
            name: 'test-agent',
            instructions: 'You are a test agent.',
            model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
          }),
        },
      ],
    });

    await harness.init();

    const cloned = await harness.cloneThread({
      sourceThreadId: 'source-thread-id',
      title: 'New title',
      resourceId: 'target-resource',
    });

    expect(memoryFactory).toHaveBeenCalledTimes(1);
    expect(cloneThread).toHaveBeenCalledWith({
      sourceThreadId: 'source-thread-id',
      resourceId: 'target-resource',
      title: 'New title',
    });
    expect(cloned.id).toBe('cloned-thread-id');
    expect(cloned.resourceId).toBe('target-resource');
  });

  it('throws when dynamic memory factory returns empty value', async () => {
    const harness = new Harness({
      id: 'test-harness',
      memory: vi.fn().mockResolvedValue(undefined) as unknown as any,
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: new Agent({
            name: 'test-agent',
            instructions: 'You are a test agent.',
            model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
          }),
        },
      ],
    });

    await harness.init();

    await expect(harness.cloneThread({ sourceThreadId: 'source-thread-id' })).rejects.toThrow(
      'Dynamic memory factory returned empty value',
    );
  });
});
