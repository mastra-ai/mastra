import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => vi.resetModules());

const mockLoadSettings = vi.hoisted(() => vi.fn<() => Record<string, unknown>>());

vi.mock('../../onboarding/settings.js', () => ({
  loadSettings: mockLoadSettings,
  MEMORY_GATEWAY_DEFAULTS: { apiKey: null, baseUrl: null },
}));

vi.mock('../../utils/project', () => ({
  getOmScope: vi.fn(() => 'thread'),
}));

vi.mock('../model', () => ({
  resolveModel: vi.fn(() => ({ __provider: 'mock' })),
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
  ctx.set('harness', {
    threadId: 'test-thread',
    resourceId: 'test-resource',
    observationThreshold: 10_000 + testCounter,
    ...overrides,
  });
  return ctx;
}

describe('getDynamicMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoryCalls.length = 0;
    // Reset module-level cache by re-importing would be ideal, but we can
    // force cache miss by varying thresholds via harness state
  });

  it('creates Memory with OM enabled when memoryGateway.apiKey is null', () => {
    mockLoadSettings.mockReturnValue({ memoryGateway: { apiKey: null, baseUrl: null } });

    const factory = getDynamicMemory({} as any);
    factory({ requestContext: makeRequestContext() });

    expect(memoryCalls).toHaveLength(1);
    const omConfig = (memoryCalls[0].options as any).observationalMemory;
    expect(omConfig.enabled).toBe(true);
  });

  it('creates Memory with OM disabled when memoryGateway.apiKey is set', () => {
    mockLoadSettings.mockReturnValue({ memoryGateway: { apiKey: 'mg-key-abc', baseUrl: null } });

    const factory = getDynamicMemory({} as any);
    factory({ requestContext: makeRequestContext() });

    expect(memoryCalls).toHaveLength(1);
    const omConfig = (memoryCalls[0].options as any).observationalMemory;
    expect(omConfig.enabled).toBe(false);
  });

  it('falls back to MEMORY_GATEWAY_DEFAULTS when memoryGateway is missing from settings', () => {
    mockLoadSettings.mockReturnValue({});

    const factory = getDynamicMemory({} as any);
    factory({ requestContext: makeRequestContext() });

    expect(memoryCalls).toHaveLength(1);
    const omConfig = (memoryCalls[0].options as any).observationalMemory;
    expect(omConfig.enabled).toBe(true);
  });
});
