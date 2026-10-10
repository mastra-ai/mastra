import { stateSchema } from '@mastra/code-sdk/schema';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

const prime = vi.fn<(context: unknown) => Promise<void>>().mockResolvedValue(undefined);
vi.mock('../routes/tenant-credentials.js', () => ({
  primeTenantCredentialsForRequestContext: (context: unknown) => prime(context),
}));

import {
  prepareSessionRunContext,
  resolveSubscriptionSession,
  subscriptionRunContext,
} from './subscription-session.js';
import type { SubscriptionSessionRow } from './subscription-session.js';

function row(overrides: Partial<SubscriptionSessionRow['data']> = {}, orgId = 'org-1'): SubscriptionSessionRow {
  return {
    id: 'sub-1',
    orgId,
    targetKey: 'change-request:x',
    sessionId: 'session-1',
    resourceId: 'factory-1',
    threadId: 'thread-1',
    sessionScope: '',
    status: 'open',
    data: { projectRepositoryId: 'repo-1', subscribedByUserId: 'user-1', ...overrides },
    createdAt: new Date('2026-09-21T00:00:00Z'),
    updatedAt: new Date('2026-09-21T00:00:00Z'),
  };
}

beforeEach(() => {
  prime.mockClear();
});

describe('resolveSubscriptionSession', () => {
  it.each([false, true])('restores the subscribed thread independently of the Factory row (cold=%s)', async cold => {
    const controller = new AgentController<MastraCodeState>({
      id: 'code',
      stateSchema,
      storage: new InMemoryStore({ id: 'subscription-single-thread-host' }),
      workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
      modes: [
        {
          id: 'build',
          name: 'Build',
          default: true,
          agent: new Agent({
            id: 'test-agent',
            name: 'Test agent',
            instructions: 'Test subscription addressing.',
            model: { id: 'openai/gpt-5.5' },
          }),
        },
      ],
    });
    await controller.init();
    const original = await controller.createSession({
      id: 'session-1',
      ownerId: 'user-1',
      resourceId: 'session-1',
      threadId: 'thread-1',
    });
    onTestFinished(async () => {
      await controller.deleteSession({ resourceId: 'session-1' });
    });
    if (cold) await controller.deleteSession({ resourceId: 'session-1' });
    else {
      await original.thread.create();
      expect(original.thread.getId()).not.toBe('thread-1');
    }
    const queryThread = vi.spyOn(controller, 'queryThreadById');
    const getBySessionId = vi.fn(async () => ({ userId: 'user-1', orgId: 'org-1' }));
    const session = await resolveSubscriptionSession(controller, row(), {
      label: 'Test',
      sourceControl: { sessions: { getBySessionId } },
    });
    expect(queryThread).toHaveBeenCalledWith({ threadId: 'thread-1' });
    expect(getBySessionId).toHaveBeenCalledWith('session-1');
    expect(getBySessionId).not.toHaveBeenCalledWith('thread-1');
    expect(getBySessionId).not.toHaveBeenCalledWith('factory-1');
    expect(session?.identity.getId()).toBe('session-1');
    expect(session?.identity.getResourceId()).toBe('session-1');
    expect(session?.thread.getId()).toBe('thread-1');
    expect(session?.state.get()).toMatchObject({ factoryOrgId: 'org-1' });
    if (!cold) expect(session).toBe(original);
  });
});

describe('subscriptionRunContext', () => {
  it('runs as the subscribing user in the subscription organization and primes credentials', async () => {
    const context = await subscriptionRunContext(row(), undefined);
    expect(context?.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
    expect(prime).toHaveBeenCalledTimes(1);
    expect(prime.mock.calls[0]?.[0]).toBe(context);
  });

  it('falls back to the Factory session owner when the row names no user', async () => {
    const getBySessionId = vi.fn(async () => ({ userId: 'owner-2', orgId: 'org-2' }));
    const context = await subscriptionRunContext(row({ subscribedByUserId: null }), { sessions: { getBySessionId } });
    expect(getBySessionId).toHaveBeenCalledWith('session-1');
    expect(context?.get('user')).toEqual({ workosId: 'owner-2', organizationId: 'org-2' });
  });

  it('returns no context, and does not prime, when no identity can be resolved', async () => {
    const context = await subscriptionRunContext(row({ subscribedByUserId: null }), {
      sessions: { getBySessionId: async () => null },
    });
    expect(context).toBeUndefined();
    expect(prime).not.toHaveBeenCalled();
  });

  it('rejects when priming fails, naming the subscription and keeping the cause', async () => {
    const cause = new Error('storage down');
    prime.mockRejectedValueOnce(cause);
    const attempt = subscriptionRunContext(row(), undefined);
    await expect(attempt).rejects.toThrow('Unable to prime tenant credentials for subscription sub-1; not delivered.');
    await expect(attempt).rejects.toMatchObject({ cause });
  });
});

describe('prepareSessionRunContext', () => {
  it('runs as the Factory session owner in its organization and primes credentials', async () => {
    const getBySessionId = vi.fn(async () => ({ userId: 'user-9', orgId: 'org-9' }));
    const requestContext = new RequestContext();
    await expect(prepareSessionRunContext(requestContext, 'session-9', { sessions: { getBySessionId } })).resolves.toBe(
      'prepared',
    );
    expect(getBySessionId).toHaveBeenCalledWith('session-9');
    expect(requestContext.get('user')).toEqual({ workosId: 'user-9', organizationId: 'org-9' });
    expect(prime).toHaveBeenCalledTimes(1);
    expect(prime.mock.calls[0]?.[0]).toBe(requestContext);
  });

  it('leaves the context alone, and does not prime, when no Factory session matches', async () => {
    const requestContext = new RequestContext();
    await expect(
      prepareSessionRunContext(requestContext, 'channel:slack:C1', {
        sessions: { getBySessionId: async () => null },
      }),
    ).resolves.toBe('unavailable');
    expect(requestContext.get('user')).toBeUndefined();
    expect(prime).not.toHaveBeenCalled();
  });

  it('leaves the context alone, and does not prime, when the session org is unresolved', async () => {
    const requestContext = new RequestContext();
    await expect(
      prepareSessionRunContext(requestContext, 'session-9', {
        sessions: { getBySessionId: async () => ({ userId: 'user-9', orgId: ' ' }) },
      }),
    ).resolves.toBe('unavailable');
    expect(requestContext.get('user')).toBeUndefined();
    expect(prime).not.toHaveBeenCalled();
  });

  it('reports an organization mismatch without changing the context or priming credentials', async () => {
    const requestContext = new RequestContext();
    await expect(
      prepareSessionRunContext(
        requestContext,
        'session-9',
        { sessions: { getBySessionId: async () => ({ userId: 'user-9', orgId: 'org-9' }) } },
        { expectedOrgId: 'org-other' },
      ),
    ).resolves.toBe('organization-mismatch');
    expect(requestContext.get('user')).toBeUndefined();
    expect(prime).not.toHaveBeenCalled();
  });
});
