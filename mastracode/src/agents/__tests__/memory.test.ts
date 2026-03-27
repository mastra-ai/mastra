import { beforeEach, describe, expect, it, vi } from 'vitest';

const memoryInstances = vi.hoisted(() => [] as Array<{ config: unknown }>);
const mockMemory = vi.hoisted(() =>
  vi.fn(function (this: { config: unknown }, config: unknown) {
    this.config = config;
    memoryInstances.push(this);
  }),
);
const mockGetOmScope = vi.hoisted(() => vi.fn(() => 'thread'));
const mockResolveModel = vi.hoisted(() => vi.fn((modelId: string) => ({ modelId })));

vi.mock('@mastra/memory', () => ({
  Memory: mockMemory,
}));

vi.mock('../../utils/project.js', () => ({
  getOmScope: mockGetOmScope,
}));

vi.mock('../model.js', () => ({
  resolveModel: mockResolveModel,
}));

type MockMemoryConfig =
  | {
      storage: Record<string, string>;
      options: {
        observationalMemory: false;
      };
    }
  | {
      storage: Record<string, string>;
      options: {
        observationalMemory: {
          enabled: true;
          scope: 'thread' | 'resource';
        };
      };
    };

describe('getDynamicMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    memoryInstances.length = 0;
  });

  it('disables observational memory when requested', async () => {
    const { getDynamicMemory } = await import('../memory.js');
    const storage = { id: 'storage' };

    const memory = getDynamicMemory(
      storage,
      false,
    )({
      requestContext: { get: vi.fn().mockReturnValue(undefined) } as unknown as { get: ReturnType<typeof vi.fn> },
    });

    expect(mockMemory).toHaveBeenCalledTimes(1);
    expect(mockMemory).toHaveBeenCalledWith({
      storage,
      options: {
        observationalMemory: false,
      },
    });
    expect(mockGetOmScope).not.toHaveBeenCalled();
    expect(memory).toBe(memoryInstances[0]);
  });

  it('keeps the enabled and disabled memory caches separate', async () => {
    const { getDynamicMemory } = await import('../memory.js');
    const storage = { id: 'storage' };
    const requestContext = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as { get: ReturnType<typeof vi.fn> };

    const enabledMemory = getDynamicMemory(storage)({ requestContext });
    const disabledMemory = getDynamicMemory(storage, false)({ requestContext });

    expect(mockMemory).toHaveBeenCalledTimes(2);
    expect(enabledMemory).not.toBe(disabledMemory);
    const enabledConfig = mockMemory.mock.calls[0]?.[0] as MockMemoryConfig;
    const disabledConfig = mockMemory.mock.calls[1]?.[0] as MockMemoryConfig;

    expect(enabledConfig.options.observationalMemory).toMatchObject({
      enabled: true,
      scope: 'thread',
    });
    expect(disabledConfig.options.observationalMemory).toBe(false);
  });
});
