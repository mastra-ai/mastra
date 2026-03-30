import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => vi.resetModules());

const mockGetStoredApiKey = vi.hoisted(() => vi.fn<(provider: string) => string | undefined>());

vi.mock('../../auth/storage.js', () => ({
  AuthStorage: class MockAuthStorage {
    getStoredApiKey = mockGetStoredApiKey;
  },
}));

vi.mock('../../onboarding/settings.js', () => ({
  MEMORY_GATEWAY_PROVIDER: 'memory-gateway',
}));

vi.mock('../../utils/project', () => ({
  getOmScope: vi.fn(() => 'thread'),
}));

vi.mock('../model', () => ({
  resolveModel: vi.fn(() => ({ __provider: 'mock' })),
}));

vi.mock('@mastra/fastembed', () => ({
  fastembed: { small: {} },
}));

// Capture the options passed to Memory constructor
const memoryCalls: Array<Record<string, unknown>> = [];
vi.mock('@mastra/memory', () => ({
  Memory: vi.fn(function (this: Record<string, unknown>, opts: Record<string, unknown>) {
    memoryCalls.push(opts);
    this.__memory = true;
    this.opts = opts;
  }),
}));

import { getDynamicMemory } from '../memory.js';

let testCounter = 0;

function makeRequestContext(overrides?: Record<string, unknown>) {
  const ctx = new RequestContext();
  // Use unique thresholds per call to bust the module-level cache
  testCounter++;
  const state = {
    threadId: 'test-thread',
    resourceId: 'test-resource',
    observationThreshold: 10_000 + testCounter,
    ...overrides,
  };
  ctx.set('harness', { ...state, getState: () => state });
  return ctx;
}

describe('getDynamicMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoryCalls.length = 0;
  });

  it('returns a memory factory with OM enabled when no memory gateway API key stored', () => {
    mockGetStoredApiKey.mockReturnValue(undefined);

    const factory = getDynamicMemory({} as any);
    expect(factory).toBeDefined();

    factory!({ requestContext: makeRequestContext() });

    expect(memoryCalls).toHaveLength(1);
    const omConfig = (memoryCalls[0].options as any).observationalMemory;
    expect(omConfig.enabled).toBe(true);
  });

  it('returns undefined when memory gateway API key is stored (gateway handles everything)', () => {
    mockGetStoredApiKey.mockReturnValue('mg-key-abc');

    const factory = getDynamicMemory({} as any);
    expect(factory).toBeUndefined();
  });

  it('returns a memory factory when memory gateway key is not present (defaults)', () => {
    mockGetStoredApiKey.mockReturnValue(undefined);

    const factory = getDynamicMemory({} as any);
    expect(factory).toBeDefined();

    factory!({ requestContext: makeRequestContext() });

    expect(memoryCalls).toHaveLength(1);
    const omConfig = (memoryCalls[0].options as any).observationalMemory;
    expect(omConfig.enabled).toBe(true);
  });
});
