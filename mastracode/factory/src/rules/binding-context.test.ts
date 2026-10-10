import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import {
  getFactorySessionAddress,
  getFactorySessionCoordinates,
  resolveFactorySessionAddress,
} from './binding-context.js';

function context(threadId: string | null) {
  const requestContext = new RequestContext();
  requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
  requestContext.set('controller', {
    threadId,
    resourceId: 'session-1',
    session: { id: 'session-1' },
    getState: () => ({ factoryProjectId: 'project-1' }),
  });
  return requestContext;
}

describe('Factory single-thread host coordinates', () => {
  it('uses the controller thread binding without rekeying the Factory session row', () => {
    const requestContext = context('conversation-1');
    expect(getFactorySessionCoordinates(requestContext)).toEqual({
      factoryProjectId: 'project-1',
      sessionId: 'session-1',
      resourceId: 'session-1',
      threadId: 'conversation-1',
    });
    expect(getFactorySessionAddress(requestContext)).toEqual({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      sessionId: 'session-1',
      resourceId: 'session-1',
      threadId: 'conversation-1',
    });
  });

  it('does not invent a thread from the session id when the host is unbound', async () => {
    const requestContext = context(null);
    expect(getFactorySessionCoordinates(requestContext)).toBeNull();
    expect(getFactorySessionAddress(requestContext)).toBeNull();
    await expect(
      resolveFactorySessionAddress({
        requestContext,
        storage: {
          findActiveRunBindingByThread: async () => {
            throw new Error('An unbound host must not look up a binding.');
          },
          get: async () => null,
        },
      }),
    ).resolves.toBeNull();
  });
});
