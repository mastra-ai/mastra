import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import { createPlatformProxy } from '../runtime/platform-proxy.js';

describe('createPlatformProxy request context binding', () => {
  it('starts unbound and binds a per-request context without mutating the base proxy', () => {
    const base = createPlatformProxy({ connectionId: 'conn-1' });
    expect(base.requestContext).toBeUndefined();

    const requestContext = new RequestContext();
    requestContext.set('externalUserId', 'user-42');
    const bound = base.withRequestContext(requestContext);

    expect(bound).not.toBe(base);
    expect(bound.requestContext).toBe(requestContext);
    expect(base.requestContext).toBeUndefined();
  });

  it('keeps the full proxy surface on the bound copy', () => {
    const bound = createPlatformProxy({ connectionId: 'conn-1' }).withRequestContext(new RequestContext());
    expect(typeof bound.get).toBe('function');
    expect(typeof bound.post).toBe('function');
    expect(typeof bound.log).toBe('function');
    expect(bound.ActionError).toBeDefined();
  });
});
