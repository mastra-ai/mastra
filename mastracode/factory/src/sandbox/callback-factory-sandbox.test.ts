import { describeFactorySandbox, isFactorySandbox } from '@mastra/core/workspace';
import { describe, expect, it, vi } from 'vitest';
import { CallbackFactorySandbox } from './callback-factory-sandbox.js';

describe('CallbackFactorySandbox', () => {
  it('is a custom provider with no settings, template or builds that delegates create to the callback', () => {
    const created = { id: 'sb' } as never;
    const callback = vi.fn(() => created);
    const sandbox = new CallbackFactorySandbox(callback);
    expect(isFactorySandbox(sandbox)).toBe(true);
    expect(describeFactorySandbox(sandbox)).toEqual({
      provider: 'custom',
      settingsSchema: expect.objectContaining({ type: 'object', properties: {}, additionalProperties: false }),
      templateFields: [],
      capabilities: { template: false, builds: { available: false, history: false } },
    });
    const ctx = { sessionId: 's1', sandboxId: 'vm', getRepositoryAccess: undefined };
    expect(sandbox.create(ctx, {})).toBe(created);
    expect(callback).toHaveBeenCalledWith(ctx);
  });
});
