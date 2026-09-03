import { describe, expect, it } from 'vitest';

import { executeWithContext, getCurrentSpan, initContextStorage } from './context-storage';
import { resolveCurrentSpan } from './utils';

describe('context storage registration', () => {
  it('registers the Node context storage resolver used by the root utilities entry', async () => {
    initContextStorage();

    const span = { id: 'span', traceId: 'trace' } as any;
    await executeWithContext({
      span,
      fn: async () => {
        expect(getCurrentSpan()).toBe(span);
        expect(resolveCurrentSpan()).toBe(span);
      },
    });

    expect(resolveCurrentSpan()).toBeUndefined();
  });
});
