import type { RequestContext } from '@mastra/core/request-context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the options passed to the Memory constructor so we can assert which
// model each observational-memory role is wired to.
const { memoryOpts } = vi.hoisted(() => {
  const memoryOpts: { last: any } = { last: null };
  return { memoryOpts };
});

vi.mock('@mastra/memory', () => ({
  Memory: class {
    constructor(opts: any) {
      memoryOpts.last = opts;
    }
  },
}));

vi.mock('@mastra/fastembed', () => ({
  fastembed: { small: { id: 'fastembed-small' } },
}));

vi.mock('../../utils/project', () => ({
  getOmScope: () => 'thread',
}));

// Avoid pulling in the model resolver's AuthStorage (filesystem access at import).
vi.mock('../model', () => ({
  resolveModel: vi.fn(),
}));

import { getDynamicMemory } from '../memory';

const storage = { id: 'store' } as any;

function callFactory(observationalModel?: any) {
  const factory = getDynamicMemory(storage, undefined, observationalModel);
  // No harness state set — the factory falls back to defaults.
  factory({ requestContext: { get: () => undefined } as unknown as RequestContext });
  return memoryOpts.last.options.observationalMemory;
}

describe('getDynamicMemory observationalModel override', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memoryOpts.last = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the provided instance for both observer and reflector', () => {
    const model = { modelId: 'vertex-gemini' } as any;
    const om = callFactory(model);

    expect(om.observation.model).toBe(model);
    expect(om.reflection.model).toBe(model);
  });

  it('falls back to the dynamic model resolvers when no instance is provided', () => {
    const om = callFactory();

    // Without an override, each role keeps its state-driven resolver function.
    expect(typeof om.observation.model).toBe('function');
    expect(typeof om.reflection.model).toBe('function');
  });
});
