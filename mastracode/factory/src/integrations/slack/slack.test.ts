import { ChannelSessionRejectedError, AgentChannels } from '@mastra/core/channels';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FACTORY_INTERACTIVE_KEY } from '../../auth.js';
import { NEW_CHANNEL_SESSION_KEY } from '../../session/channel-session-link-processor.js';
import type { ExternalWorkItemSource } from '../../storage/domains/work-items/base.js';
import { FACTORY_SLACK_SENDER_KEY } from '../../tools/scope.js';

// Captures the tenant each prime saw: the stamp can be overwritten later in
// the gate, so asserting on the final request context alone isn't enough.
const primedUsers: unknown[] = [];
const prime = vi.fn(async (context: RequestContext) => {
  primedUsers.push(context.get('user'));
});
const primeTenant = vi.fn(async (_tenant: unknown) => undefined);
const providerDefault = vi.fn(
  async (_tenant: unknown, _current: string | undefined): Promise<string | undefined> => undefined,
);
vi.mock('../../routes/tenant-credentials.js', () => ({
  primeTenantCredentialsForRequestContext: (context: RequestContext) => prime(context),
  primeTenantCredentialsForTenant: (tenant: unknown) => primeTenant(tenant),
  resolveTenantProviderDefaultModel: (tenant: unknown, current: string | undefined) => providerDefault(tenant, current),
}));

import {
  createChannelResourceIdResolver,
  createChannelSessionResolver,
  createChannelSessionStartHook,
  createChannelThreadIdResolver,
  createHandlers,
  resolveLinkedSender,
  resolveFactoryForLink,
} from './slack.js';
import type { SlackStartedSessions } from './slack.js';

/**
 * The 4th argument core hands every channel handler. The handlers write the
 * resolved tenant onto `requestContext`, so tests that drive them must pass a
 * real one — a bare `{}` throws once the sender resolves as linked.
 */
function handlerCtx(mastra?: unknown) {
  return { mastra: mastra as any, requestContext: new RequestContext() };
}

function chatOnlyMastra() {
  return {
    getStorage: () => ({
      getStore: vi.fn().mockResolvedValue({
        listThreads: vi.fn().mockResolvedValue({ threads: [{ id: 'thread-1', resourceId: 'channel:slack-thread-1' }] }),
      }),
    }),
  };
}

function makeThread({ isDM = false } = {}) {
  return {
    adapter: { name: 'slack' },
    channelId: 'C-1',
    isDM,
    post: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    postEphemeral: vi.fn().mockResolvedValue({ id: 'eph-1' }),
    startTyping: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function makeMessage(teamId?: string) {
  return {
    author: { userId: 'U-sender', userName: 'caleb' },
    text: 'hello bot',
    raw: teamId ? { team_id: teamId } : {},
  } as any;
}

function makeStore(link: { orgId?: string; userId: string } | null) {
  return { getAccountLink: vi.fn().mockResolvedValue(link) } as any;
}

const OLD_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.restoreAllMocks();
  prime.mockClear();
  primedUsers.length = 0;
});

describe('resolveLinkedSender', () => {
  it('is ungated (dispatch) when no account-link store is configured', async () => {
    const thread = makeThread();
    const result = await resolveLinkedSender({ thread, message: makeMessage('T-1') });
    expect(result).toEqual({ status: 'ungated' });
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('resolves the tenant for a linked sender, no card posted', async () => {
    const thread = makeThread();
    const accountLinks = makeStore({ orgId: 'org-1', userId: 'user-1' });
    const result = await resolveLinkedSender({ thread, message: makeMessage('T-1'), accountLinks });
    expect(result.status).toBe('linked');
    // The resolved link is what the handler stamps onto the request context.
    expect(result).toMatchObject({ link: { orgId: 'org-1', userId: 'user-1' } });
    expect(accountLinks.getAccountLink).toHaveBeenCalledWith({
      platform: 'slack',
      externalTeamId: 'T-1',
      externalUserId: 'U-sender',
    });
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('blocks the run and posts an ephemeral Connect card for an unlinked sender', async () => {
    process.env.MASTRACODE_CHANNELS_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeThread();
    const accountLinks = makeStore(null);

    const result = await resolveLinkedSender({ thread, message: makeMessage('T-1'), accountLinks });

    expect(result).toEqual({ status: 'blocked' });
    expect(thread.postEphemeral).toHaveBeenCalledTimes(1);

    // Ephemeral (visible only to the sender), with fallbackToDM.
    // Addressed to the sender, not the channel: the card is a private nudge.
    const [user, , options] = thread.postEphemeral.mock.calls[0];
    expect(user).toEqual({ userId: 'U-sender', userName: 'caleb' });
    expect(options).toEqual({ fallbackToDM: true });

    // The link carries NO identity: Slack proves the account during OIDC, so
    // a forwarded card can't bind the original sender to whoever clicks it.
    const card = thread.postEphemeral.mock.calls[0][1];
    expect(JSON.stringify(card)).toContain('then mention me again.');
    const actions = card.children.find((c: any) => c.type === 'actions');
    const linkButton = actions.children.find((c: any) => c.type === 'link-button');
    expect(linkButton.url).toBe('https://mc.example.com/connect/slack');
  });

  it('tells an unlinked sender in a DM to message the bot again', async () => {
    process.env.MASTRACODE_CHANNELS_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeThread({ isDM: true });

    await resolveLinkedSender({ thread, message: makeMessage('T-1'), accountLinks: makeStore(null) });

    const card = thread.postEphemeral.mock.calls[0][1];
    expect(JSON.stringify(card)).toContain('then message me again.');
  });

  it('treats a missing team id as unlinked and blocks the run, still offering the card', async () => {
    process.env.MASTRACODE_CHANNELS_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeThread();
    const accountLinks = makeStore({ orgId: 'org-1', userId: 'user-1' });

    const result = await resolveLinkedSender({ thread, message: makeMessage(undefined), accountLinks });

    // No team id → never even looks up the (workspace-scoped) link, blocks run.
    expect(result).toEqual({ status: 'blocked' });
    expect(accountLinks.getAccountLink).not.toHaveBeenCalled();
    // The card needs no team id now, and connecting is still the way out.
    expect(thread.postEphemeral).toHaveBeenCalledTimes(1);
  });

  it('blocks the run without a card when no public URL is configured', async () => {
    delete process.env.MASTRACODE_CHANNELS_PUBLIC_URL;
    delete process.env.MASTRACODE_PUBLIC_URL;
    const thread = makeThread();
    const accountLinks = makeStore(null);

    const result = await resolveLinkedSender({ thread, message: makeMessage('T-1'), accountLinks });

    expect(result).toEqual({ status: 'blocked' });
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });
});

const linkKey = { platform: 'slack', externalTeamId: 'T-1', externalUserId: 'U-sender' };

function makeProjects(factories: Array<{ id: string; name?: string }>) {
  const projects = factories.map(factory => ({ ...factory }));
  return {
    get: vi.fn(async ({ id }: { id: string }) => projects.find(f => f.id === id) ?? null),
    list: vi.fn(async () => projects),
  } as any;
}

function makeLinkStore() {
  return { setDefaultFactory: vi.fn().mockResolvedValue(true) } as any;
}

describe('resolveFactoryForLink', () => {
  it('is ungated when no projects domain is configured', async () => {
    const thread = makeThread();
    const result = await resolveFactoryForLink({
      thread,
      link: { orgId: 'org-1', userId: 'user-1', linkedAt: new Date() },
      key: linkKey,
      accountLinks: makeLinkStore(),
    });
    expect(result).toEqual({ status: 'ungated' });
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('uses the link default when the factory still exists', async () => {
    const thread = makeThread();
    const projects = makeProjects([{ id: 'fp-1' }, { id: 'fp-2' }]);
    const accountLinks = makeLinkStore();

    const result = await resolveFactoryForLink({
      thread,
      link: { orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fp-2', linkedAt: new Date() },
      key: linkKey,
      accountLinks,
      projects,
    });

    expect(result).toEqual({ status: 'resolved', factoryProjectId: 'fp-2' });
    expect(projects.get).toHaveBeenCalledWith({ orgId: 'org-1', id: 'fp-2' });
    // Existing default: nothing re-stamped, no card.
    expect(accountLinks.setDefaultFactory).not.toHaveBeenCalled();
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('auto-resolves and stamps the tenant only factory', async () => {
    const thread = makeThread();
    const projects = makeProjects([{ id: 'fp-only' }]);
    const accountLinks = makeLinkStore();

    const result = await resolveFactoryForLink({
      thread,
      link: { orgId: 'org-1', userId: 'user-1', linkedAt: new Date() },
      key: linkKey,
      accountLinks,
      projects,
    });

    expect(result).toEqual({ status: 'resolved', factoryProjectId: 'fp-only' });
    expect(accountLinks.setDefaultFactory).toHaveBeenCalledWith({
      ...linkKey,
      userId: 'user-1',
      factoryProjectId: 'fp-only',
    });
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('a stale default (deleted factory) falls through to the multi-factory prompt', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeThread();
    const projects = makeProjects([{ id: 'fp-1' }, { id: 'fp-2' }]);
    const accountLinks = makeLinkStore();

    const result = await resolveFactoryForLink({
      thread,
      link: { orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fp-gone', linkedAt: new Date() },
      key: linkKey,
      accountLinks,
      projects,
    });

    expect(result).toEqual({ status: 'blocked' });
    // Public thread prompt deep-links to Connected Accounts settings.
    expect(thread.post).toHaveBeenCalledTimes(1);
    expect(thread.postEphemeral).not.toHaveBeenCalled();
    const card = thread.post.mock.calls[0][0];
    const actions = card.children.find((c: any) => c.type === 'actions');
    const linkButton = actions.children.find((c: any) => c.type === 'link-button');
    expect(linkButton.url).toBe('https://mc.example.com/settings/connections');
    expect(accountLinks.setDefaultFactory).not.toHaveBeenCalled();
  });

  it('multiple factories with no default prompts and blocks the run', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeThread();
    const projects = makeProjects([{ id: 'fp-1' }, { id: 'fp-2' }]);

    const result = await resolveFactoryForLink({
      thread,
      link: { orgId: 'org-1', userId: 'user-1', linkedAt: new Date() },
      key: linkKey,
      accountLinks: makeLinkStore(),
      projects,
    });

    expect(result).toEqual({ status: 'blocked' });
    expect(thread.post).toHaveBeenCalledTimes(1);
    expect(thread.postEphemeral).not.toHaveBeenCalled();
    expect(JSON.stringify(thread.post.mock.calls[0][0])).toContain('then mention me again.');
  });

  it('tells a sender in a DM to message the bot again after picking a factory', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeThread({ isDM: true });

    await resolveFactoryForLink({
      thread,
      link: { orgId: 'org-1', userId: 'user-1', linkedAt: new Date() },
      key: linkKey,
      accountLinks: makeLinkStore(),
      projects: makeProjects([{ id: 'fp-1' }, { id: 'fp-2' }]),
    });

    expect(JSON.stringify(thread.post.mock.calls[0][0])).toContain('then message me again.');
  });

  it('a personal account (no org) has no factories and is prompted', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeThread();
    const projects = makeProjects([{ id: 'fp-1' }]);

    const result = await resolveFactoryForLink({
      thread,
      link: { userId: 'user-1', linkedAt: new Date() },
      key: linkKey,
      accountLinks: makeLinkStore(),
      projects,
    });

    expect(result).toEqual({ status: 'blocked' });
    // Org-less: never lists factories (they're org-scoped).
    expect(projects.list).not.toHaveBeenCalled();
    expect(thread.post).toHaveBeenCalledTimes(1);
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('blocks without a card when no public URL is configured', async () => {
    delete process.env.MASTRACODE_CHANNELS_PUBLIC_URL;
    delete process.env.MASTRACODE_PUBLIC_URL;
    const thread = makeThread();
    const projects = makeProjects([{ id: 'fp-1' }, { id: 'fp-2' }]);

    const result = await resolveFactoryForLink({
      thread,
      link: { orgId: 'org-1', userId: 'user-1', linkedAt: new Date() },
      key: linkKey,
      accountLinks: makeLinkStore(),
      projects,
    });

    expect(result).toEqual({ status: 'blocked' });
    expect(thread.post).not.toHaveBeenCalled();
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });
});

describe('handler dispatch gating', () => {
  function makeSubscribedThread() {
    const thread = makeThread();
    thread.isSubscribed = vi.fn().mockResolvedValue(true);
    return thread;
  }

  function fullStore(link: { orgId?: string; userId: string; defaultFactoryProjectId?: string } | null) {
    return {
      getAccountLink: vi.fn().mockResolvedValue(link),
      setDefaultFactory: vi.fn().mockResolvedValue(true),
    } as any;
  }

  it('dispatches a linked sender whose default factory resolves, under their tenant', async () => {
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fp-1' });
    const projects = makeProjects([{ id: 'fp-1' }]);
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks, projects });

    const ctx = handlerCtx(chatOnlyMastra());
    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, ctx);

    expect(defaultHandler).toHaveBeenCalledTimes(1);
    expect(thread.postEphemeral).not.toHaveBeenCalled();
    // The run must carry the linked tenant, or it resolves default credentials.
    expect(ctx.requestContext.get('user')).toEqual({ id: 'user-1', organizationId: 'org-1' });
    expect(ctx.requestContext.get(FACTORY_INTERACTIVE_KEY)).toBe(true);
    expect(prime).toHaveBeenCalledExactlyOnceWith(ctx.requestContext);
  });

  it("primes the linked sender's credentials before a fresh mention dispatches", async () => {
    // A mention after a restart: no Factory session exists yet and nothing has
    // warmed the credential snapshot, so the gate itself must prime it.
    const thread = makeThread();
    thread.isSubscribed = vi.fn().mockResolvedValue(false);
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fp-1' });
    const projects = makeProjects([{ id: 'fp-1' }]);
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks, projects });

    const ctx = handlerCtx(chatOnlyMastra());
    await handlers.onMention!(thread, makeMessage('T-1'), defaultHandler, ctx);

    expect(defaultHandler).toHaveBeenCalledTimes(1);
    expect(prime).toHaveBeenCalledExactlyOnceWith(ctx.requestContext);
    expect(primedUsers).toEqual([{ id: 'user-1', organizationId: 'org-1' }]);
    expect(ctx.requestContext.get(FACTORY_INTERACTIVE_KEY)).toBe(true);
    expect(prime.mock.invocationCallOrder[0]).toBeLessThan(defaultHandler.mock.invocationCallOrder[0]!);
  });

  it.each(['owner-1', 'responder-1'])(
    'keeps linked Slack sender %s as the interactive tool actor in an existing session',
    async senderId => {
      const thread = makeSubscribedThread();
      const accountLinks = fullStore({ orgId: 'org-1', userId: senderId, defaultFactoryProjectId: 'fp-1' });
      const projects = makeProjects([{ id: 'fp-1' }]);
      const sourceControl = {
        sessions: {
          getBySessionId: vi.fn().mockResolvedValue({ orgId: 'org-1', userId: 'owner-1' }),
        },
      } as any;
      const mastra = {
        getStorage: () => ({
          getStore: vi.fn().mockResolvedValue({
            listThreads: vi.fn().mockResolvedValue({
              threads: [{ id: 'thread-1', resourceId: 'session-1' }],
            }),
          }),
        }),
      };
      const defaultHandler = vi.fn();
      const handlers = createHandlers({ accountLinks, projects, sourceControl });
      const message = makeMessage('T-1');

      const ctx = handlerCtx(mastra);
      await handlers.onSubscribedMessage!(thread, message, defaultHandler, ctx);

      expect(defaultHandler).toHaveBeenCalledWith(thread, message);
      expect(sourceControl.sessions.getBySessionId).toHaveBeenCalledWith('session-1');
      expect(ctx.requestContext.get('user')).toEqual({ workosId: 'owner-1', organizationId: 'org-1' });
      expect(ctx.requestContext.get(FACTORY_SLACK_SENDER_KEY)).toEqual({ userId: senderId, orgId: 'org-1' });
      expect(ctx.requestContext.get(FACTORY_INTERACTIVE_KEY)).toBe(true);
      expect(primedUsers.at(-1)).toEqual({ workosId: 'owner-1', organizationId: 'org-1' });
    },
  );

  it('does not dispatch a private Slack session for another linked participant', async () => {
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'responder-1', defaultFactoryProjectId: 'fp-1' });
    const projects = makeProjects([{ id: 'fp-1' }]);
    const sourceControl = {
      sessions: {
        getBySessionId: vi.fn().mockResolvedValue({ orgId: 'org-1', userId: 'owner-1', visibility: 'private' }),
      },
    } as any;
    const mastra = {
      getStorage: () => ({
        getStore: vi.fn().mockResolvedValue({
          listThreads: vi.fn().mockResolvedValue({ threads: [{ id: 'thread-1', resourceId: 'session-1' }] }),
        }),
      }),
    };
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks, projects, sourceControl });
    const ctx = handlerCtx(mastra);

    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, ctx);

    expect(defaultHandler).not.toHaveBeenCalled();
    expect(thread.post).toHaveBeenCalledWith('This private Factory session belongs to another user.');
    expect(ctx.requestContext.get(FACTORY_INTERACTIVE_KEY)).not.toBe(true);
  });

  it("authorizes a Factory-resource thread as its session's owner", async () => {
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'responder-1', defaultFactoryProjectId: 'fp-1' });
    const projects = makeProjects([{ id: 'fp-1' }]);
    const sourceControl = {
      sessions: {
        getBySessionId: vi.fn(async (sessionId: string) =>
          sessionId === 'session-1' ? { orgId: 'org-1', userId: 'owner-1', factoryProjectId: 'fp-1', branch: 'slack/1700-42', visibility: 'org' } : null,
        ),
      },
    } as any;
    const mastra = {
      getStorage: () => ({
        getStore: vi.fn().mockResolvedValue({
          listThreads: vi.fn().mockResolvedValue({ threads: [{ id: 'session-1', resourceId: 'fp-1' }] }),
        }),
      }),
    };
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks, projects, sourceControl });

    const ctx = handlerCtx(mastra);
    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, ctx);

    expect(defaultHandler).toHaveBeenCalled();
    // The run is authorized as the session the thread is named after, never as the shared Factory resource.
    expect(sourceControl.sessions.getBySessionId).toHaveBeenLastCalledWith('session-1');
    expect(ctx.requestContext.get('user')).toEqual({ workosId: 'owner-1', organizationId: 'org-1' });
  });

  it('authorizes a migrated legacy thread through the session id it was stamped with', async () => {
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'responder-1', defaultFactoryProjectId: 'fp-1' });
    const projects = makeProjects([{ id: 'fp-1' }]);
    const sourceControl = {
      sessions: {
        getBySessionId: vi.fn(async (sessionId: string) =>
          sessionId === 'session-1' ? { orgId: 'org-1', userId: 'owner-1', factoryProjectId: 'fp-1', branch: 'slack/1700-42', visibility: 'org' } : null,
        ),
      },
    } as any;
    // Created before Slack threads were named after their session, then moved onto the Factory.
    const legacy = { id: 'C-1:1700.42', resourceId: 'fp-1', metadata: { factorySessionId: 'session-1' } };
    const mastra = {
      getStorage: () => ({
        getStore: vi.fn().mockResolvedValue({
          listThreads: vi.fn().mockResolvedValue({ threads: [legacy] }),
          getThreadById: vi.fn(async () => null),
        }),
      }),
    };
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks, projects, sourceControl });

    const ctx = handlerCtx(mastra);
    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, ctx);

    expect(defaultHandler).toHaveBeenCalled();
    expect(ctx.requestContext.get('user')).toEqual({ workosId: 'owner-1', organizationId: 'org-1' });
  });

  it.each([
    ['another resource', { id: 'thread-atk', resourceId: 'user-atk', metadata: { factorySessionId: 'session-1' } }, {}],
    ['another resource, named after the session', { id: 'session-1', resourceId: 'user-atk' }, {}],
  ])("doesn't run a thread under %s as the session it claims", async (_case, internal, overrides) => {
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'responder-1', defaultFactoryProjectId: 'fp-1' });
    const projects = makeProjects([{ id: 'fp-1' }]);
    const sourceControl = {
      sessions: {
        getBySessionId: vi.fn(async (sessionId: string) =>
          sessionId === 'session-1' ? { ...{ orgId: 'org-1', userId: 'owner-1', factoryProjectId: 'fp-1', branch: 'slack/1700-42', visibility: 'org' }, ...overrides } : null,
        ),
      },
    } as any;
    const mastra = {
      getStorage: () => ({
        getStore: vi.fn().mockResolvedValue({
          listThreads: vi.fn().mockResolvedValue({ threads: [internal] }),
          getThreadById: vi.fn(async () => null),
        }),
      }),
    };
    const handlers = createHandlers({ accountLinks, projects, sourceControl });

    const ctx = handlerCtx(mastra);
    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), vi.fn(), ctx);

    expect(ctx.requestContext.get('user')).not.toEqual({ workosId: 'owner-1', organizationId: 'org-1' });
  });

  it('rejects an existing Factory session when the responder is linked to another organization', async () => {
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-2', userId: 'responder-1', defaultFactoryProjectId: 'fp-1' });
    const projects = makeProjects([{ id: 'fp-1' }]);
    const sourceControl = {
      sessions: {
        getBySessionId: vi.fn().mockResolvedValue({ orgId: 'org-1', userId: 'owner-1' }),
      },
    } as any;
    const output = vi.fn();
    const mastra = {
      getLogger: () => ({ error: output }),
      getStorage: () => ({
        getStore: vi.fn().mockResolvedValue({
          listThreads: vi.fn().mockResolvedValue({
            threads: [{ id: 'thread-1', resourceId: 'session-1' }],
          }),
        }),
      }),
    };
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks, projects, sourceControl });

    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, handlerCtx(mastra));

    expect(thread.post).toHaveBeenCalledExactlyOnceWith(
      'This thread belongs to a Factory session in another organization.',
    );
    expect(output).not.toHaveBeenCalled();
    expect(defaultHandler).not.toHaveBeenCalled();
    expect(prime).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'no source-control session row resolves',
      session: null,
      reason: 'no source-control session row exists for it, or its project repository row is missing',
    },
    {
      name: 'the source-control session row has no organization',
      session: { orgId: ' ', userId: 'owner-1' },
      reason: 'its source-control session row has no organization',
    },
  ])('logs why the existing Factory session owner could not be authorized when $name', async ({ session, reason }) => {
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'responder-1', defaultFactoryProjectId: 'fp-1' });
    const projects = makeProjects([{ id: 'fp-1' }]);
    const sourceControl = { sessions: { getBySessionId: vi.fn().mockResolvedValue(session) } } as any;
    const output = vi.fn();
    const mastra = {
      getLogger: () => ({ error: output }),
      getStorage: () => ({
        getStore: vi.fn().mockResolvedValue({
          listThreads: vi.fn().mockResolvedValue({ threads: [{ id: 'thread-1', resourceId: 'session-1' }] }),
        }),
      }),
    };
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks, projects, sourceControl });

    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, handlerCtx(mastra));

    expect(output).toHaveBeenCalledExactlyOnceWith(
      // With no row naming the thread, its session is the thread itself.
      expect.stringContaining(
        `Could not authorize the owner of Slack Factory session ${session ? 'session-1' : 'thread-1'}: ${reason}.`,
      ),
    );
    expect(defaultHandler).not.toHaveBeenCalled();
    expect(prime).not.toHaveBeenCalled();
  });

  it('rejects a subscribed Factory follow-up when its internal thread cannot be resolved', async () => {
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'responder-1', defaultFactoryProjectId: 'fp-1' });
    const projects = makeProjects([{ id: 'fp-1' }]);
    const sourceControl = { sessions: { getBySessionId: vi.fn() } } as any;
    const mastra = {
      getStorage: () => ({
        getStore: vi.fn().mockResolvedValue({
          listThreads: vi.fn().mockResolvedValue({ threads: [] }),
        }),
      }),
    };
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks, projects, sourceControl });

    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, handlerCtx(mastra));

    expect(thread.post).toHaveBeenCalledWith(expect.stringContaining('Couldn’t start processing your message.'));
    expect(sourceControl.sessions.getBySessionId).not.toHaveBeenCalled();
    expect(defaultHandler).not.toHaveBeenCalled();
  });

  it('rejects a subscribed follow-up without an internal thread when no source control is configured', async () => {
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'user-1' });
    const mastra = {
      getStorage: () => ({
        getStore: vi.fn().mockResolvedValue({
          listThreads: vi.fn().mockResolvedValue({ threads: [] }),
        }),
      }),
    };
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks });

    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, handlerCtx(mastra));

    expect(thread.post).toHaveBeenCalledWith(expect.stringContaining('Couldn’t start processing your message.'));
    expect(defaultHandler).not.toHaveBeenCalled();
  });

  it('stamps the tenant for a linked sender even when factory routing is ungated', async () => {
    // The silent-failure path: with no `projects` dep, `resolveFactoryForLink`
    // returns `ungated`, so this sender leaves the gate without a routed
    // result. A stamp written in the routed branch would be skipped here and
    // the sender would run on default credentials with nothing to show for it.
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'user-1' });
    const mastra = {
      getStorage: () => ({
        getStore: vi.fn().mockResolvedValue({
          listThreads: vi
            .fn()
            .mockResolvedValue({ threads: [{ id: 'thread-1', resourceId: 'channel:slack-thread-1' }] }),
        }),
      }),
    };
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks });

    const ctx = handlerCtx(mastra);
    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, ctx);

    expect(defaultHandler).toHaveBeenCalledTimes(1);
    expect(ctx.requestContext.get('user')).toEqual({ id: 'user-1', organizationId: 'org-1' });
    expect(ctx.requestContext.get(FACTORY_INTERACTIVE_KEY)).toBeUndefined();
  });

  it('does not stamp a tenant for an unlinked sender, and does not dispatch', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeSubscribedThread();
    const accountLinks = fullStore(null);
    const defaultHandler = vi.fn();
    const handlers = createHandlers({
      accountLinks,
    });

    const ctx = handlerCtx();
    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, ctx);

    // The host handler is now the only gate — core dispatches whatever reaches it.
    expect(defaultHandler).not.toHaveBeenCalled();
    expect(ctx.requestContext.get('user')).toBeUndefined();
    expect(thread.postEphemeral).toHaveBeenCalledTimes(1);
    expect(prime).not.toHaveBeenCalled();
  });

  it('blocks dispatch for a linked sender with several factories and no default', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'user-1' });
    const projects = makeProjects([{ id: 'fp-1' }, { id: 'fp-2' }]);
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks, projects });

    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, handlerCtx());

    expect(defaultHandler).not.toHaveBeenCalled();
    expect(thread.post).toHaveBeenCalledTimes(1);
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('mention handler blocks the same way before any session is created', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeThread();
    thread.isSubscribed = vi.fn().mockResolvedValue(false);
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'user-1' });
    const projects = makeProjects([{ id: 'fp-1' }, { id: 'fp-2' }]);
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks, projects });

    await handlers.onMention!(thread, makeMessage('T-1'), defaultHandler, handlerCtx());

    expect(defaultHandler).not.toHaveBeenCalled();
    expect(thread.post).toHaveBeenCalledTimes(1);
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('keeps pre-routing behavior when only account linking is configured (no projects)', async () => {
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'user-1' });
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks });

    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, handlerCtx(chatOnlyMastra()));

    expect(defaultHandler).toHaveBeenCalledTimes(1);
  });
});

describe('pre-dispatch error feedback', () => {
  const reply = 'Couldn’t start processing your message. Please try again.\n`messageId: 1700.42`';
  const slots = ['onMention', 'onDirectMessage', 'onSubscribedMessage'] as const;

  function fixture(slot: (typeof slots)[number] = 'onMention') {
    const thread = makeThread({ isDM: slot === 'onDirectMessage' });
    thread.id = 'slack:C-1:1700.42';
    thread.isSubscribed = vi.fn().mockResolvedValue(true);
    const message = { ...makeMessage('T-1'), id: '1700.42' };
    const accountLinks = {
      getAccountLink: vi.fn().mockResolvedValue({ orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fp-1' }),
      setDefaultFactory: vi.fn().mockResolvedValue(true),
    };
    const projects = makeProjects([{ id: 'fp-1' }]);
    const defaultHandler = vi.fn().mockResolvedValue(undefined);
    const output = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mastra = {
      getLogger: () => ({ error: output }),
      getStorage: () => ({
        getStore: async () => ({
          listThreads: async () => ({ threads: [{ id: 'thread-1', resourceId: 'channel:slack-thread-1' }] }),
        }),
      }),
    };
    const handlers = createHandlers({ accountLinks: accountLinks as any, projects });
    const run = (overrides?: Record<string, unknown>) =>
      handlers[slot]!(thread, message, defaultHandler, handlerCtx({ ...mastra, ...overrides }));
    const record = (index = 0) => {
      const [line, ...extra] = output.mock.calls[index]!;
      expect(extra).toEqual([]);
      expect(line).not.toContain('\n');
      return JSON.parse(line.slice(line.indexOf('{')));
    };
    return { thread, message, accountLinks, projects, defaultHandler, output, consoleError, handlers, run, record };
  }

  describe.each(slots)('%s', slot => {
    it.each(['account', 'project'])('reports a rejected %s lookup without dispatching', async source => {
      const f = fixture(slot);
      const error = new Error('lookup unavailable', { cause: new Error('database unavailable') });
      if (source === 'account') f.accountLinks.getAccountLink.mockRejectedValue(error);
      else f.projects.get.mockRejectedValue(error);

      await expect(f.run()).resolves.toBeUndefined();
      expect(f.defaultHandler).not.toHaveBeenCalled();
      expect(f.thread.post).toHaveBeenCalledExactlyOnceWith(reply);
      expect(f.output).toHaveBeenCalledTimes(1);
      expect(f.consoleError).not.toHaveBeenCalled();
      expect(f.record()).toEqual({
        platform: 'slack',
        threadId: f.thread.id,
        messageId: f.message.id,
        authorId: 'U-sender',
        error: { message: 'lookup unavailable', cause: { message: 'database unavailable' } },
      });
    });

    it.each(['connect', 'project'])('reports a failed %s card with one generic reply attempt', async card => {
      process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
      const f = fixture(slot);
      if (card === 'connect') {
        f.accountLinks.getAccountLink.mockResolvedValue(null as any);
        f.thread.postEphemeral.mockRejectedValue(new Error('card failed'));
      } else {
        f.projects.get.mockResolvedValue(null);
        f.projects.list.mockResolvedValue([]);
        f.thread.post.mockRejectedValueOnce(new Error('card failed'));
      }
      await expect(f.run()).resolves.toBeUndefined();
      expect(f.defaultHandler).not.toHaveBeenCalled();
      expect(f.thread.post.mock.calls.filter(([text]: [unknown]) => text === reply)).toHaveLength(1);
      expect(f.record().error.message).toBe('card failed');
    });

    it('logs failed generic delivery without retrying or rejecting', async () => {
      const f = fixture(slot);
      f.accountLinks.getAccountLink.mockRejectedValue(new Error('lookup failed'));
      f.thread.post.mockRejectedValue(new Error('delivery failed'));
      await expect(f.run()).resolves.toBeUndefined();
      expect(f.thread.post).toHaveBeenCalledExactlyOnceWith(reply);
      expect(f.defaultHandler).not.toHaveBeenCalled();
      expect(f.output).toHaveBeenCalledTimes(2);
      expect(f.output.mock.calls[1]![0]).toContain('Failed to deliver pre-dispatch error reply');
      expect(f.record(1)).toEqual({ ...f.record(), error: { message: 'delivery failed' } });
    });

    it('keeps deliberate refusals silent', async () => {
      const f = fixture(slot);
      f.accountLinks.getAccountLink.mockRejectedValue(new ChannelSessionRejectedError('not authorized'));
      await f.run();
      expect(f.defaultHandler).not.toHaveBeenCalled();
      expect(f.thread.post).not.toHaveBeenCalled();
      expect(f.output).not.toHaveBeenCalled();
    });

    it('preserves a blocked gate without a public URL', async () => {
      delete process.env.MASTRACODE_PUBLIC_URL;
      delete process.env.MASTRACODE_CHANNELS_PUBLIC_URL;
      const f = fixture(slot);
      f.accountLinks.getAccountLink.mockResolvedValue(null as any);
      await f.run();
      expect(f.defaultHandler).not.toHaveBeenCalled();
      expect(f.thread.post).not.toHaveBeenCalled();
      expect(f.thread.postEphemeral).not.toHaveBeenCalled();
      expect(f.output).not.toHaveBeenCalled();
    });

    it('dispatches normally exactly once', async () => {
      const f = fixture(slot);
      await f.run();
      expect(f.defaultHandler).toHaveBeenCalledExactlyOnceWith(f.thread, f.message);
      expect(f.thread.post).not.toHaveBeenCalled();
      expect(f.output).not.toHaveBeenCalled();
    });

    it('does not duplicate feedback already handled by defaultHandler', async () => {
      const f = fixture(slot);
      f.defaultHandler.mockImplementation(async () => {
        await f.thread.post('existing core feedback');
      });
      await f.run();
      expect(f.thread.post).toHaveBeenCalledExactlyOnceWith('existing core feedback');
      expect(f.output).not.toHaveBeenCalled();
    });

    it('leaves a rejecting defaultHandler outside the new catch', async () => {
      const f = fixture(slot);
      const error = new Error('default handler failed');
      f.defaultHandler.mockRejectedValue(error);
      await expect(f.run()).rejects.toBe(error);
      expect(f.thread.post).not.toHaveBeenCalled();
      expect(f.output).not.toHaveBeenCalled();
    });
  });

  it.each([
    ['plain failure', 'plain failure'],
    ['', 'Unknown error'],
    [null, 'Unknown error'],
    [undefined, 'Unknown error'],
    [{ message: '' }, 'Unknown error'],
    [{ secret: 'SENTINEL' }, 'Unknown error'],
  ])('uses only nonempty message text (%#)', async (error, expected) => {
    const f = fixture();
    f.accountLinks.getAccountLink.mockRejectedValue(error);
    await f.run();
    expect(f.record().error).toEqual({ message: expected });
    expect(f.thread.post).toHaveBeenCalledExactlyOnceWith(reply);
  });

  it.each(['cause text', ''])('selects only nonempty immediate string causes (%#)', async cause => {
    const f = fixture();
    f.accountLinks.getAccountLink.mockRejectedValue({ message: 'failure', cause });
    await f.run();
    expect(f.record().error).toEqual({ message: 'failure', ...(cause ? { cause: { message: cause } } : {}) });
  });

  it('omits payloads, stacks and deeper causes without invoking serializers', async () => {
    const f = fixture();
    const toJSON = vi.fn(() => ({ secret: 'SENTINEL_SERIALIZER' }));
    const stack = vi.fn(() => {
      throw new Error('SENTINEL_STACK');
    });
    const cause = { message: 'cause\ntext', cause: { message: 'SENTINEL_DEEP_CAUSE' }, toJSON };
    const error = { message: 'failure\ntext', cause, details: { token: 'SENTINEL_DETAILS' }, toJSON };
    Object.defineProperty(error, 'stack', { get: stack });
    f.accountLinks.getAccountLink.mockRejectedValue(error);
    await f.run();
    expect(f.record().error).toEqual({ message: 'failure\ntext', cause: { message: 'cause\ntext' } });
    expect(f.output.mock.calls[0]![0]).not.toContain('SENTINEL');
    expect(toJSON).not.toHaveBeenCalled();
    expect(stack).not.toHaveBeenCalled();
    expect(f.thread.post).toHaveBeenCalledExactlyOnceWith(reply);
  });

  it.each(['message', 'cause'])('uses a static diagnostic if reading %s throws', async property => {
    const f = fixture();
    const error = Object.defineProperty({}, property, {
      get() {
        throw new Error('SENTINEL_GETTER');
      },
    });
    f.accountLinks.getAccountLink.mockRejectedValue(error);
    await f.run();
    expect(f.record().error).toEqual({ message: 'Error details unavailable' });
    expect(f.thread.post).toHaveBeenCalledExactlyOnceWith(reply);
  });

  it('preserves the subscribed aside early return', async () => {
    const f = fixture('onSubscribedMessage');
    f.message.text = 'aside: leave this alone';
    f.accountLinks.getAccountLink.mockRejectedValue(new Error('should not be reached'));
    await f.run();
    expect(f.accountLinks.getAccountLink).not.toHaveBeenCalled();
    expect(f.defaultHandler).not.toHaveBeenCalled();
    expect(f.thread.post).not.toHaveBeenCalled();
    expect(f.output).not.toHaveBeenCalled();
  });

  it('falls back to console.error when the handler context has no Mastra instance', async () => {
    const f = fixture();
    f.accountLinks.getAccountLink.mockRejectedValue(new Error('lookup unavailable'));
    await f.handlers.onMention!(f.thread, f.message, f.defaultHandler, handlerCtx());
    expect(f.output).not.toHaveBeenCalled();
    expect(f.consoleError).toHaveBeenCalledTimes(1);
    const [line, ...extra] = f.consoleError.mock.calls[0]!;
    expect(extra).toEqual([]);
    expect(JSON.parse(line.slice(line.indexOf('{')))).toMatchObject({ error: { message: 'lookup unavailable' } });
    expect(f.thread.post).toHaveBeenCalledExactlyOnceWith(reply);
  });
});

describe('repo-backed thread sessions (resolveResourceId)', () => {
  // Shaped like the real `SourceControlStorageHandle` the Slack wiring now
  // consumes directly: repo resolution is the shared factory-session helper,
  // so the stub has to answer the same row lookups it makes.
  function makeSourceControl({
    existingSession = null as { sessionId: string } | null,
    hasRepo = true,
    integrationId = 'github',
  } = {}) {
    return {
      integrationId,
      connections: {
        list: vi.fn().mockResolvedValue([{ id: `conn-${integrationId}`, integrationId, createdByUserId: 'owner-1' }]),
      },
      projectRepositories: {
        list: vi.fn().mockResolvedValue(hasRepo ? [{ id: 'pr-1', repositoryId: 'repo-1', branch: null }] : []),
        // The environment's links, position-ordered; the session is filed under position 1.
        listByProject: vi.fn().mockResolvedValue(
          hasRepo
            ? [
                {
                  id: 'pr-1',
                  connectionId: `conn-${integrationId}`,
                  repositoryId: 'repo-1',
                  branch: null,
                  position: 1,
                  inEnvironment: true,
                  createdAt: new Date(0),
                },
              ]
            : [],
        ),
      },
      repositories: { get: vi.fn().mockResolvedValue({ defaultBranch: 'main', slug: 'acme/app' }) },
      sessions: {
        getForBranch: vi.fn().mockResolvedValue(existingSession),
        create: vi.fn().mockResolvedValue({ sessionId: 'us-new' }),
      },
    };
  }

  function makeResolverDeps({
    link = { orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fp-1' } as {
      orgId?: string;
      userId: string;
      defaultFactoryProjectId?: string;
    } | null,
    sourceControl = makeSourceControl(),
  } = {}) {
    const accountLinks = {
      getAccountLink: vi.fn().mockResolvedValue(link),
      setDefaultFactory: vi.fn().mockResolvedValue(true),
    } as any;
    const projects = makeProjects([{ id: 'fp-1' }]);
    return { accountLinks, projects, sourceControl };
  }

  // The thread-id resolver names a new thread after the session the resourceId
  // resolver started for the same message.
  const started: SlackStartedSessions = new WeakMap();
  const threadIdFor = (args: ReturnType<typeof resolveArgs>) =>
    createChannelThreadIdResolver(started)({ ...args, resourceId: 'fp-1', defaultThreadId: 'uuid-1' } as any);

  const resolveArgs = (thread = { id: 'slack:C-1:1700.42' }) => ({
    platform: 'slack',
    thread: thread as any,
    message: makeMessage('T-1'),
    defaultResourceId: 'slack:U-sender',
  });

  it('a linked sender with a repo-backed factory gets a Factory session on the Factory resource, row created with repo + thread branch', async () => {
    const deps = makeResolverDeps();
    const resolve = createChannelResourceIdResolver(deps as any, started);

    const args = resolveArgs();
    await expect(resolve(args)).resolves.toBe('fp-1');
    expect(threadIdFor(args)).toBe('us-new');

    expect(deps.sourceControl.connections.list).toHaveBeenCalledWith({
      orgId: 'org-1',
      factoryProjectId: 'fp-1',
    });
    // Attributed to the Slack sender, not to whoever connected the repository.
    expect(deps.sourceControl.sessions.create).toHaveBeenCalledWith({
      sessionId: expect.any(String),
      projectRepositoryId: 'pr-1',
      factoryProjectId: 'fp-1',
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'slack/1700-42',
      baseBranch: 'main',
      visibility: 'org',
    });
  });

  it('selects the GitLab partition linked to the routed Factory project', async () => {
    const github = makeSourceControl({ hasRepo: false });
    const gitlab = makeSourceControl({ integrationId: 'gitlab' });
    const { sourceControl: _legacy, ...deps } = makeResolverDeps();
    const resolve = createChannelResourceIdResolver({ ...deps, sourceControls: [github, gitlab] } as any, started);

    const args = resolveArgs();
    await expect(resolve(args)).resolves.toBe('fp-1');
    expect(threadIdFor(args)).toBe('us-new');

    expect(github.sessions.create).not.toHaveBeenCalled();
    expect(gitlab.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ projectRepositoryId: 'pr-1' }));
  });

  it('a DM thread creates a private session under the sender; channel threads stay org-visible on the Factory', async () => {
    const deps = makeResolverDeps();
    const resolve = createChannelResourceIdResolver(deps as any, started);

    const args = resolveArgs({ id: 'slack:D-1:1700.42', isDM: true } as any);
    await expect(resolve(args)).resolves.toBe('user-1');
    expect(threadIdFor(args)).toBe('us-new');

    expect(deps.sourceControl.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'private' }));
  });

  // Top-level DM and channel conversations use the empty-threadTs thread form
  // (`slack:D-1:`), which previously derived the invalid git ref `slack/` and
  // made every top-level DM session fail its clone.
  it.each([
    { id: 'slack:D-1:', branch: 'slack/D-1' },
    { id: 'slack:C-1:', branch: 'slack/C-1' },
  ])(
    'a top-level conversation thread (empty threadTs) derives its branch from the channel id ($id)',
    async ({ id, branch }) => {
      const deps = makeResolverDeps();
      const resolve = createChannelResourceIdResolver(deps as any, started);

      const args = resolveArgs({ id });
      await expect(resolve(args)).resolves.toBe('fp-1');
      expect(threadIdFor(args)).toBe('us-new');

      expect(deps.sourceControl.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ branch }));
    },
  );

  it('a repeat message on the same thread reuses the existing session, no second row', async () => {
    const sourceControl = makeSourceControl({ existingSession: { sessionId: 'us-existing' } });
    const deps = makeResolverDeps({ sourceControl });
    const resolve = createChannelResourceIdResolver(deps as any, started);

    const args = resolveArgs();
    await expect(resolve(args)).resolves.toBe('fp-1');
    expect(threadIdFor(args)).toBe('us-existing');

    expect(sourceControl.sessions.getForBranch).toHaveBeenCalledWith({
      factoryProjectId: 'fp-1',
      userId: 'user-1',
      branch: 'slack/1700-42',
    });
    expect(sourceControl.sessions.create).not.toHaveBeenCalled();
  });

  it('no sourceControl → chat-only channel resourceId', async () => {
    const { sourceControl: _unused, ...deps } = makeResolverDeps();
    const resolve = createChannelResourceIdResolver(deps as any, started);

    await expect(resolve(resolveArgs())).resolves.toBe('channel:slack:C-1:1700.42');
  });

  it('an unlinked sender is refused rather than given a chat-only thread', async () => {
    const sourceControl = makeSourceControl();
    const deps = makeResolverDeps({ link: null, sourceControl });
    const resolve = createChannelResourceIdResolver(deps as any, started);

    await expect(resolve(resolveArgs())).rejects.toThrow(ChannelSessionRejectedError);
    await expect(resolve(resolveArgs())).rejects.toThrow(/not linked to a Factory account/);
    expect(sourceControl.connections.list).not.toHaveBeenCalled();
    expect(sourceControl.sessions.create).not.toHaveBeenCalled();
  });

  it('a linked sender with no project to route to is refused', async () => {
    const sourceControl = makeSourceControl();
    const deps = makeResolverDeps({ sourceControl });
    deps.projects = makeProjects([{ id: 'fp-1' }, { id: 'fp-2' }]);
    deps.accountLinks.getAccountLink = vi.fn().mockResolvedValue({ orgId: 'org-1', userId: 'user-1' });
    const resolve = createChannelResourceIdResolver(deps as any, started);

    await expect(resolve(resolveArgs())).rejects.toThrow(/has no Factory project/);
    expect(sourceControl.sessions.create).not.toHaveBeenCalled();
  });

  it('a message with no sender id falls back to the chat-only resourceId', async () => {
    const sourceControl = makeSourceControl();
    const deps = makeResolverDeps({ sourceControl });
    const resolve = createChannelResourceIdResolver(deps as any, started);

    const args = resolveArgs();
    args.message.author.userId = '';
    await expect(resolve(args)).resolves.toBe('channel:slack:C-1:1700.42');
    expect(sourceControl.sessions.create).not.toHaveBeenCalled();
  });

  it('a message from no identifiable Slack workspace is refused', async () => {
    const sourceControl = makeSourceControl();
    const deps = makeResolverDeps({ sourceControl });
    const resolve = createChannelResourceIdResolver(deps as any, started);

    const args = resolveArgs();
    args.message.raw = {};
    await expect(resolve(args)).rejects.toThrow(ChannelSessionRejectedError);
    expect(sourceControl.sessions.create).not.toHaveBeenCalled();
  });

  it.each([
    { failure: 'missing connection', expected: /connect source control/i },
    { failure: 'missing repository', expected: /link a repository/i },
    { failure: 'multiple providers', expected: /repositories from more than one source-control provider/i },
    { failure: 'account-link reread', expected: /try again later/i },
    { failure: 'project reread', expected: /try again later/i },
    { failure: 'source-control selection', expected: /try again later/i },
    { failure: 'repository resolution', expected: /try again later/i },
    { failure: 'project repository read', expected: /try again later/i },
    { failure: 'repository read', expected: /try again later/i },
    { failure: 'session lookup', expected: /try again later/i },
    { failure: 'session creation', expected: /try again later/i },
  ])('posts one safe explanation for $failure without creating a thread or card', async ({ failure, expected }) => {
    const sourceControl = makeSourceControl({
      hasRepo: !['missing connection', 'missing repository'].includes(failure),
    });
    if (failure === 'missing connection') sourceControl.connections.list.mockResolvedValue([]);
    const outage = new Error('db down: postgres://private');
    if (failure === 'source-control selection') sourceControl.connections.list.mockRejectedValue(outage);
    if (failure === 'repository resolution') {
      sourceControl.connections.list
        .mockResolvedValueOnce([{ id: 'conn-github', integrationId: 'github', createdByUserId: 'owner-1' }])
        .mockRejectedValueOnce(outage);
    }
    if (failure === 'project repository read')
      sourceControl.projectRepositories.listByProject.mockRejectedValue(outage);
    if (failure === 'repository read') sourceControl.repositories.get.mockRejectedValue(outage);
    if (failure === 'session lookup') sourceControl.sessions.getForBranch.mockRejectedValue(outage);
    if (failure === 'session creation') sourceControl.sessions.create.mockRejectedValue(outage);
    const deps = makeResolverDeps({ sourceControl });
    deps.projects = makeProjects([{ id: 'fp-1' }]);
    if (failure === 'account-link reread') {
      deps.accountLinks.getAccountLink
        .mockResolvedValueOnce({
          orgId: 'org-1',
          userId: 'user-1',
          defaultFactoryProjectId: 'fp-1',
        })
        .mockRejectedValueOnce(outage);
    }
    if (failure === 'project reread')
      deps.projects.get.mockResolvedValueOnce({ id: 'fp-1' }).mockRejectedValueOnce(outage);
    const resolverDeps =
      failure === 'multiple providers'
        ? { ...deps, sourceControls: [sourceControl, makeSourceControl({ integrationId: 'gitlab' })] }
        : deps;
    const workItems = { upsert: vi.fn() };
    const store = { listThreads: vi.fn().mockResolvedValue({ threads: [] }), saveThread: vi.fn() };
    const mastra = { getStorage: () => ({ getStore: async () => store }) };
    const thread = {
      ...makeThread(),
      id: 'slack:C-1:1700.42',
      isSubscribed: vi.fn().mockResolvedValue(false),
      post: vi.fn().mockResolvedValue({ id: 'posted-1' }),
    };
    const message = { ...makeMessage('T-1'), id: 'msg-1', attachments: [] };
    const channels = new AgentChannels({
      adapters: { slack: { name: 'slack' } as any },
      resolveResourceId: createChannelResourceIdResolver(resolverDeps as any, started),
    });
    const handlers = createHandlers({ ...resolverDeps, workItems } as any);
    const ctx = handlerCtx(mastra);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await handlers.onDirectMessage!(
      thread,
      message,
      (t: any, m: any) => (channels as any).handleChatMessage(t, m, mastra, ctx.requestContext, {}),
      ctx,
    );

    expect(thread.post).toHaveBeenCalledTimes(1);
    expect(thread.post.mock.calls[0]![0]).toMatch(expected);
    expect(thread.post.mock.calls[0]![0]).not.toContain('db down');
    expect(thread.post.mock.calls[0]![0]).not.toContain('postgres://');
    if (['missing connection', 'missing repository', 'multiple providers'].includes(failure)) {
      expect(errorLog).not.toHaveBeenCalled();
    } else {
      expect(errorLog).toHaveBeenCalledWith(
        '[slack] failed to start repo-backed session for thread',
        'slack:C-1:1700.42',
        outage,
      );
    }
    expect(thread.postEphemeral).not.toHaveBeenCalled();
    expect(store.saveThread).not.toHaveBeenCalled();
    expect(workItems.upsert).not.toHaveBeenCalled();
    if (failure === 'session creation') expect(sourceControl.sessions.create).toHaveBeenCalledTimes(1);
    else expect(sourceControl.sessions.create).not.toHaveBeenCalled();
  });
});

describe('channel session creation context (resolveSession)', () => {
  it('seeds Factory ownership before the controller session is created', async () => {
    const sourceControl = {
      sessions: {
        getBySessionId: vi.fn().mockResolvedValue({
          orgId: 'org-1',
          userId: 'user-1',
          projectRepositoryId: 'pr-1',
          factoryProjectId: 'fp-1',
        }),
      },
    };
    const controller = { id: 'code', queryThreadById: vi.fn().mockResolvedValue(null), createSession: vi.fn().mockResolvedValue({ identity: 'session' }) };
    const requestContext = new RequestContext();

    const session = await createChannelSessionResolver({ sourceControl } as any)({
      controller,
      thread: { id: 'session-1', resourceId: 'session-1' },
      requestContext,
    } as any);

    expect(session).toEqual({ identity: 'session' });
    expect(controller.createSession).toHaveBeenCalledWith({
      id: 'session-1',
      ownerId: 'code',
      resourceId: 'session-1',
      requestContext,
      tags: { factoryProjectId: 'fp-1' },
      // Binds the Slack-created thread itself: a scoped session would otherwise
      // auto-select (or create) a different thread and switch onto this one later.
      threadId: 'session-1',
    });
  });

  it('runs a session-bound thread under its Factory resource, addressed by its session id', async () => {
    const row = {
      orgId: 'org-1',
      userId: 'user-1',
      projectRepositoryId: 'pr-1',
      factoryProjectId: 'fp-1',
      branch: 'slack/1700-42',
      visibility: 'org',
    };
    const sourceControl = {
      sessions: { getBySessionId: vi.fn(async (sessionId: string) => (sessionId === 'session-1' ? row : null)) },
    };
    const controller = { id: 'code', queryThreadById: vi.fn().mockResolvedValue(null), createSession: vi.fn().mockResolvedValue({}) };

    await createChannelSessionResolver({ sourceControl } as any)({
      controller,
      thread: { id: 'session-1', resourceId: 'fp-1' },
    } as any);

    expect(controller.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'session-1',
        resourceId: 'fp-1',
        threadId: 'session-1',
        tags: { factoryProjectId: 'fp-1' },
      }),
    );
  });

  it('addresses a thread under the Factory with no session row by its own id, not the shared resource', async () => {
    const sourceControl = { sessions: { getBySessionId: vi.fn(async () => null) } };
    const controller = {
      id: 'code',
      queryThreadById: vi.fn(async () => null),
      createSession: vi.fn().mockResolvedValue({}),
    };

    await createChannelSessionResolver({ sourceControl } as any)({
      controller,
      thread: { id: 'thread-9', resourceId: 'fp-1' },
    } as any);

    expect(controller.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'thread-9', resourceId: 'fp-1', threadId: 'thread-9' }),
      );
    });

  it('resolves a migrated legacy thread passed without metadata through its stored session stamp', async () => {
    const row = {
      orgId: 'org-1',
      userId: 'user-1',
      projectRepositoryId: 'pr-1',
      factoryProjectId: 'fp-1',
      branch: 'slack/1700-42',
      visibility: 'org',
    };
    const sourceControl = {
      sessions: { getBySessionId: vi.fn(async (sessionId: string) => (sessionId === 'session-1' ? row : null)) },
    };
    const legacy = { id: 'C-1:1700.42', resourceId: 'fp-1' };
    const controller = {
      id: 'code',
      queryThreadById: vi.fn(async ({ threadId }: { threadId: string }) =>
        threadId === legacy.id ? { ...legacy, metadata: { factorySessionId: 'session-1' } } : null,
      ),
      createSession: vi.fn().mockResolvedValue({}),
    };

    // Approval clicks resolve the session from the bare thread address.
    await createChannelSessionResolver({ sourceControl } as any)({ controller, thread: legacy } as any);

    expect(controller.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1', resourceId: 'fp-1', threadId: 'C-1:1700.42' }),
    );
  });

  it("doesn't resolve a thread under the Factory to a DM session it is stamped with", async () => {
    const dm = {
      orgId: 'org-1',
      userId: 'user-1',
      projectRepositoryId: 'pr-1',
      factoryProjectId: 'fp-1',
      branch: 'slack/1700-42',
      visibility: 'private',
    };
    const sourceControl = {
      sessions: { getBySessionId: vi.fn(async (sessionId: string) => (sessionId === 'session-1' ? dm : null)) },
    };
    const forged = { id: 'thread-atk', resourceId: 'fp-1', metadata: { factorySessionId: 'session-1' } };
    const controller = { id: 'code', queryThreadById: vi.fn(async () => null), createSession: vi.fn().mockResolvedValue({}) };

    await createChannelSessionResolver({ sourceControl } as any)({ controller, thread: forged } as any);

    expect(controller.createSession).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'session-1' }));
  });

  it("doesn't resolve a thread under the Factory to a private run it is stamped with", async () => {
    const run = {
      sessionId: 'session-1',
      orgId: 'org-1',
      userId: 'user-1',
      projectRepositoryId: 'pr-1',
      factoryProjectId: 'fp-1',
      branch: 'factory/run-1',
      visibility: 'private',
    };
    const sourceControl = {
      sessions: { getBySessionId: vi.fn(async (sessionId: string) => (sessionId === 'session-1' ? run : null)) },
    };
    // The run is bound and its own thread is under the Factory, so only the stamp's trust decides.
    const workItems = { hasRunBindingForSession: vi.fn(async () => true) };
    const forged = { id: 'thread-atk', resourceId: 'fp-1', metadata: { factorySessionId: 'session-1' } };
    const controller = {
      id: 'code',
      queryThreadById: vi.fn(async ({ threadId }: { threadId: string }) =>
        threadId === 'session-1' ? { id: 'session-1', resourceId: 'fp-1' } : null,
      ),
      createSession: vi.fn().mockResolvedValue({}),
    };

    await createChannelSessionResolver({ sourceControl, workItems } as any)({ controller, thread: forged } as any);

    expect(controller.createSession).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'session-1' }));
  });

  it('leaves ownership off a session row whose factory the backfill could not resolve', async () => {
    const sourceControl = {
      sessions: {
        getBySessionId: vi
          .fn()
          .mockResolvedValue({ orgId: 'org-1', userId: 'user-1', projectRepositoryId: 'pr-1', factoryProjectId: null }),
      },
    };
    const controller = { id: 'code', queryThreadById: vi.fn().mockResolvedValue(null), createSession: vi.fn().mockResolvedValue({}) };

    await createChannelSessionResolver({ sourceControl } as any)({
      controller,
      thread: { id: 'session-1', resourceId: 'session-1' },
    } as any);

    expect(controller.createSession.mock.calls[0]?.[0].tags).toBeUndefined();
  });

  it('keeps chat-only sessions free of Factory ownership', async () => {
    const sourceControl = {
      sessions: { getBySessionId: vi.fn() },
    };
    const controller = { id: 'code', queryThreadById: vi.fn().mockResolvedValue(null), createSession: vi.fn().mockResolvedValue({}) };

    await createChannelSessionResolver({ sourceControl } as any)({
      controller,
      thread: { id: 'thread-1', resourceId: 'channel:slack:C-1:1700.42' },
    } as any);

    expect(sourceControl.sessions.getBySessionId).not.toHaveBeenCalled();
    expect(controller.createSession.mock.calls[0]?.[0].tags?.factoryProjectId).toBeUndefined();
    expect(controller.createSession).toHaveBeenCalledWith({
      id: 'channel:slack:C-1:1700.42',
      ownerId: 'code',
      resourceId: 'channel:slack:C-1:1700.42',
      threadId: 'thread-1',
      requestContext: undefined,
    });
  });
});

describe('repo-backed thread ids (resolveThreadId)', () => {
  it('a repo-backed thread takes its session id as its thread id (web convention: threadId = sessionId)', () => {
    const started: SlackStartedSessions = new WeakMap();
    const message = makeMessage('T-1');
    started.set(message, 'us-new');
    expect(
      createChannelThreadIdResolver(started)({ message, resourceId: 'fp-1', defaultThreadId: 'uuid-1' } as any),
    ).toBe('us-new');
  });

  it('a chat-only thread keeps the default random id', () => {
    expect(
      createChannelThreadIdResolver(new WeakMap())({
        message: makeMessage('T-1'),
        resourceId: 'channel:slack:C-1:1700.42',
        defaultThreadId: 'uuid-1',
      } as any),
    ).toBe('uuid-1');
  });
});

describe('new session link', () => {
  function makeLinkDeps() {
    const accountLinks = {
      getAccountLink: vi.fn().mockResolvedValue({ orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fp-1' }),
      setDefaultFactory: vi.fn().mockResolvedValue(true),
    } as any;
    return { accountLinks, projects: makeProjects([{ id: 'fp-1', name: 'Acme' }]) };
  }

  function makeLinkThread({ subscribed = false } = {}) {
    const thread = makeThread();
    thread.id = 'slack:C-1:1700.42';
    thread.isSubscribed = vi.fn().mockResolvedValue(subscribed);
    thread.post = vi.fn();
    return thread;
  }

  it('marks the run that opens a thread so the link processor ends the first reply with the session link', async () => {
    const deps = makeLinkDeps();
    const thread = makeLinkThread();
    const ctx = handlerCtx();
    const defaultHandler = vi.fn();

    await createHandlers(deps as any).onDirectMessage!(thread, makeMessage('T-1'), defaultHandler, ctx);

    expect(ctx.requestContext.get(NEW_CHANNEL_SESSION_KEY)).toBe(true);
    expect(defaultHandler).toHaveBeenCalledTimes(1);
    // Nothing of Factory's own: link and reply are one message.
    expect(thread.post).not.toHaveBeenCalled();
  });

  it('a follow-up mention on a subscribed thread is not marked', async () => {
    const deps = makeLinkDeps();
    const thread = makeLinkThread({ subscribed: true });
    const ctx = handlerCtx();
    const defaultHandler = vi.fn();

    await createHandlers(deps as any).onMention!(thread, makeMessage('T-1'), defaultHandler, ctx);

    expect(ctx.requestContext.get(NEW_CHANNEL_SESSION_KEY)).toBeUndefined();
    expect(defaultHandler).toHaveBeenCalledTimes(1);
    expect(thread.post).not.toHaveBeenCalled();
  });
});

describe('early typing status', () => {
  function makeDeps(link: { orgId?: string; userId: string; defaultFactoryProjectId?: string } | null) {
    const accountLinks = {
      getAccountLink: vi.fn().mockResolvedValue(link),
      setDefaultFactory: vi.fn().mockResolvedValue(true),
    } as any;
    const store = {
      listThreads: vi.fn().mockResolvedValue({ threads: [{ id: 'uuid-thread-1', resourceId: 'us-42' }] }),
    };
    const mastra = { getStorage: () => ({ getStore: () => Promise.resolve(store) }) };
    return { accountLinks, projects: makeProjects([{ id: 'fp-1' }]), mastra };
  }
  const linked = { orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fp-1' };

  function makeTypingThread() {
    const thread = makeThread();
    thread.id = 'slack:C-1:1700.42';
    thread.isSubscribed = vi.fn().mockResolvedValue(true);
    return thread;
  }

  it('a linked sender sees the bot thinking before the run is dispatched', async () => {
    const deps = makeDeps(linked);
    const handlers = createHandlers(deps as any);
    const thread = makeTypingThread();
    const order: string[] = [];
    thread.startTyping.mockImplementation(async () => void order.push('typing'));
    const defaultHandler = vi.fn(async () => void order.push('run'));

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), defaultHandler, handlerCtx(deps.mastra));

    expect(thread.startTyping).toHaveBeenCalledWith('is thinking...');
    expect(order).toEqual(['typing', 'run']);
  });

  it('a subscribed follow-up gets the same early status', async () => {
    const deps = makeDeps(linked);
    const handlers = createHandlers(deps as any);
    const thread = makeTypingThread();

    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), vi.fn(), handlerCtx(deps.mastra));

    expect(thread.startTyping).toHaveBeenCalledWith('is thinking...');
  });

  it('an unlinked sender gets the Connect card, never a typing status', async () => {
    const deps = makeDeps(null);
    const handlers = createHandlers(deps as any);
    const thread = makeTypingThread();

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn(), handlerCtx(deps.mastra));

    expect(thread.startTyping).not.toHaveBeenCalled();
  });

  it('respects typingStatus: false on the adapter options', async () => {
    const deps = { ...makeDeps(linked), adapterOptions: { typingStatus: false as const } };
    const handlers = createHandlers(deps as any);
    const thread = makeTypingThread();

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn(), handlerCtx(deps.mastra));

    expect(thread.startTyping).not.toHaveBeenCalled();
  });

  it('a failing status call does not stop the run', async () => {
    const deps = makeDeps(linked);
    const handlers = createHandlers(deps as any);
    const thread = makeTypingThread();
    thread.startTyping.mockRejectedValue(new Error('slack down'));
    const defaultHandler = vi.fn().mockResolvedValue(undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), defaultHandler, handlerCtx(deps.mastra));
    await new Promise(resolve => setImmediate(resolve));

    expect(defaultHandler).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('Slack threads create no work items', () => {
  function makeWorkItemDeps({
    internalThread = { id: 'uuid-thread-1', resourceId: 'us-42' } as { id: string; resourceId: string },
  } = {}) {
    const accountLinks = {
      getAccountLink: vi.fn().mockResolvedValue({ orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fp-1' }),
      setDefaultFactory: vi.fn().mockResolvedValue(true),
    } as any;
    const store = { listThreads: vi.fn().mockResolvedValue({ threads: [internalThread] }) };
    const mastra = { getStorage: () => ({ getStore: () => Promise.resolve(store) }) };
    const upsert = vi.fn().mockResolvedValue({ created: true });
    // A factory row from before the setting was removed, with it still on.
    const projects = makeProjects([{ id: 'fp-1', slackWorkItemsEnabled: true } as any]);
    return { accountLinks, projects, mastra, workItems: { upsert } as any, upsert };
  }

  function makeWorkItemThread() {
    const thread = makeThread();
    thread.id = 'slack:C-1:1700.42';
    thread.isSubscribed = vi.fn().mockResolvedValue(false);
    thread.post = vi.fn();
    return thread;
  }

  it('a routed DM starts the session without creating a work item', async () => {
    const deps = makeWorkItemDeps();
    const thread = makeWorkItemThread();
    const defaultHandler = vi.fn();

    await createHandlers(deps as any).onDirectMessage!(
      thread,
      makeMessage('T-1'),
      defaultHandler,
      handlerCtx(deps.mastra),
    );

    expect(defaultHandler).toHaveBeenCalledTimes(1);
    expect(deps.upsert).not.toHaveBeenCalled();
  });

  it('a routed @-mention starts the session without creating a work item', async () => {
    const deps = makeWorkItemDeps();
    const thread = makeWorkItemThread();
    const defaultHandler = vi.fn();

    await createHandlers(deps as any).onMention!(thread, makeMessage('T-1'), defaultHandler, handlerCtx(deps.mastra));

    expect(defaultHandler).toHaveBeenCalledTimes(1);
    expect(deps.upsert).not.toHaveBeenCalled();
  });

  it('a chat-only (channel:) thread creates no work item', async () => {
    const deps = makeWorkItemDeps({ internalThread: { id: 'uuid-thread-1', resourceId: 'channel:slack:C-1:1700.42' } });
    const thread = makeWorkItemThread();
    const defaultHandler = vi.fn();

    await createHandlers(deps as any).onDirectMessage!(
      thread,
      makeMessage('T-1'),
      defaultHandler,
      handlerCtx(deps.mastra),
    );

    expect(defaultHandler).toHaveBeenCalledTimes(1);
    expect(deps.upsert).not.toHaveBeenCalled();
  });
});

/**
 * Sessions created by the channel machinery are configured here or nowhere.
 * Without this hook a Slack session runs on the SDK's built-in mode default
 * (`openai/gpt-5.5`), so a factory pointed at any other provider fails every
 * message with a missing-credentials error.
 */
describe('session start (onSessionStart)', () => {
  function makeSession({
    persistedModel = null as string | null,
    persistedModeModel = null as string | null,
    mode = 'build',
    currentModel = 'openai/gpt-5.5',
    // Thread settings outlive the session object that wrote them; pass the same
    // map to a second session to stand in for a restarted process.
    settings = new Map<string, unknown>(),
    sessionId = 'us-1',
    // Session-bound Slack sessions run under their Factory's resource.
    resourceId = 'fp-1',
  } = {}) {
    if (persistedModel) settings.set('currentModelId', persistedModel);
    if (persistedModeModel) settings.set(`modeModelId_${mode}`, persistedModeModel);
    return {
      identity: { getId: () => sessionId, getResourceId: () => resourceId },
      mode: { get: () => mode, resolve: () => ({ defaultModelId: currentModel }) },
      thread: {
        getId: vi.fn(() => 'thread-1'),
        getById: vi.fn(async () => ({ metadata: Object.fromEntries(settings) })),
        getSetting: vi.fn(async ({ key }: { key: string }) => settings.get(key) ?? null),
        setSetting: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
          if (value === undefined) settings.delete(key);
          else settings.set(key, value);
        }),
        setSettingOn: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
          if (value === undefined) settings.delete(key);
          else settings.set(key, value);
        }),
      },
      model: {
        get: vi.fn(() => currentModel),
        // Real `switch` is what makes a model choice durable: it applies the
        // model and writes it to the thread's current model setting.
        switch: vi.fn(async (modelId: string) => {
          settings.set('currentModelId', modelId);
          settings.set('modelPersistenceVersion', 2);
        }),
      },
      om: {
        observer: makeOmRole('initial/model'),
        reflector: makeOmRole('initial/model'),
      },
      state: { get: vi.fn(() => ({})), set: vi.fn(async () => {}) },
      subagents: { model: { set: vi.fn(async (_: { modelId: string; agentType?: string }) => {}) } },
      /** The model a restarted process would restore from the thread. */
      restoredModel: () => settings.get('currentModelId') ?? settings.get(`modeModelId_${mode}`) ?? null,
    };
  }

  /** Mirrors the real roles: `modelId()` reports what the last switch selected. */
  function makeOmRole(initial: string) {
    let current = initial;
    return {
      modelId: vi.fn(() => current),
      switchModel: vi.fn(async ({ modelId }: { modelId: string }) => {
        current = modelId;
      }),
      switchSelection: vi.fn(
        async ({ selection }: { selection: { mode: 'auto' } | { mode: 'model'; modelId: string } }) => {
          if (selection.mode === 'model') current = selection.modelId;
        },
      ),
    };
  }

  function makeStartDeps({
    defaultModelId = 'anthropic/claude-opus-5' as string | null,
    session = { orgId: 'org-1', userId: 'user-1', projectRepositoryId: 'pr-1', factoryProjectId: 'fp-1' } as Record<
      string,
      string
    > | null,
    memoryRecord = null as Record<string, unknown> | null,
    personalMemoryRecord = null as Record<string, unknown> | null,
    personalMemoryLookupError = null as Error | null,
    userDefaultModel = null as string | null,
    defaultLookupError = null as Error | null,
    modelScope = 'factory' as 'factory' | 'user' | 'hybrid',
  } = {}) {
    return {
      projects: { getById: vi.fn(async () => ({ id: 'fp-1', orgId: 'org-1', defaultModelId, modelScope })) } as any,
      sourceControl: {
        sessions: { getBySessionId: vi.fn(async () => session) },
      } as any,
      memorySettings: {
        // Two rows share this table: the project's (a `factory-project:` sentinel
        // key) and the sender's own (their user id).
        get: vi.fn(async ({ userId }: { userId: string }) => {
          if (userId.startsWith('factory-project:')) return memoryRecord;
          if (personalMemoryLookupError) throw personalMemoryLookupError;
          return personalMemoryRecord;
        }),
      } as any,
      modelDefaults: {
        get: vi.fn(async () => {
          if (defaultLookupError) throw defaultLookupError;
          return userDefaultModel ? { modelId: userDefaultModel } : null;
        }),
      } as any,
    };
  }

  const startArgs = (session: unknown, resourceId = 'us-1') => ({
    session: session as any,
    thread: { id: resourceId, resourceId },
  });

  it('a repo-backed session adopts the factory default model instead of the SDK default', async () => {
    const deps = makeStartDeps();
    const { model, ...rest } = makeSession();
    const session = { model, ...rest };

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.model.switch).toHaveBeenCalledWith('anthropic/claude-opus-5');
    // Resolved from the session row, by session id rather than the shared Factory
    // resource, so it works on a thread created before this process started.
    expect(deps.sourceControl.sessions.getBySessionId).toHaveBeenCalledWith('us-1');
    expect(deps.sourceControl.sessions.getBySessionId).not.toHaveBeenCalledWith('fp-1');
    expect(deps.projects.getById).toHaveBeenCalledWith({ id: 'fp-1' });
    // The Factory's threads share one resource; the stamp ties this one to its session.
    expect(session.thread.setSettingOn).toHaveBeenCalledWith({
      threadId: expect.any(String),
      key: 'factorySessionId',
      value: 'us-1',
    });
    // Factory scope never reads the owner's personal model default.
    expect(deps.modelDefaults.get).not.toHaveBeenCalled();
    expect(session.state.set).toHaveBeenCalledWith({
      factoryProjectId: 'fp-1',
      factoryModelScope: 'factory',
      factoryOwnerUserId: 'user-1',
    });
    expect(session.model.switch).toHaveBeenCalledTimes(1);
    expect(session.restoredModel()).toBe('anthropic/claude-opus-5');
  });

  // The sender's own choice outranks the factory's shared default.
  it("starts on the linked sender's default model rather than the factory default", async () => {
    const deps = makeStartDeps({ modelScope: 'user', userDefaultModel: 'openai/gpt-5.6' });
    const session = makeSession();

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    // Keyed by the org/user pair the source-control row resolved, not by
    // anything the Slack payload claimed.
    expect(deps.modelDefaults.get).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1' });
    expect(session.model.switch).toHaveBeenLastCalledWith('openai/gpt-5.6');
    expect(session.restoredModel()).toBe('openai/gpt-5.6');
    expect(session.subagents.model.set.mock.calls.slice(-3).map(([arg]) => arg)).toEqual([
      { modelId: 'openai/gpt-5.6', agentType: 'explore' },
      { modelId: 'openai/gpt-5.6', agentType: 'plan' },
      { modelId: 'openai/gpt-5.6', agentType: 'execute' },
    ]);
  });

  it("starts a hybrid Factory's Slack session on the owner's default and personal scope", async () => {
    const deps = makeStartDeps({ modelScope: 'hybrid', userDefaultModel: 'openai/gpt-5.6' });
    const session = makeSession();

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(deps.modelDefaults.get).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1' });
    expect(session.state.set).toHaveBeenCalledWith({
      factoryProjectId: 'fp-1',
      factoryModelScope: 'user',
      factoryOwnerUserId: 'user-1',
    });
    expect(session.restoredModel()).toBe('openai/gpt-5.6');
  });

  it.each(['active', 'revoked'] as const)(
    'keeps a hybrid Slack work-item thread Factory-paid with a %s binding',
    async status => {
      const deps = {
        ...makeStartDeps({ modelScope: 'hybrid', userDefaultModel: 'openai/gpt-5.6' }),
        workItems: { findRunBindingByThread: vi.fn(async () => ({ factoryProjectId: 'fp-1', status })) },
      };
      const session = makeSession();

      await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

      expect(deps.workItems.findRunBindingByThread).toHaveBeenCalledWith({
        orgId: 'org-1',
        resourceId: 'fp-1',
        sessionId: 'us-1',
        threadId: 'thread-1',
        rejectAmbiguous: true,
      });
      expect(session.state.set).toHaveBeenCalledWith({
        factoryProjectId: 'fp-1',
        factoryModelScope: 'factory',
        factoryOwnerUserId: 'user-1',
      });
      expect(deps.modelDefaults.get).not.toHaveBeenCalled();
      expect(session.restoredModel()).toBe('anthropic/claude-opus-5');
    },
  );

  // Subagent models aren't persisted on the thread, so a restarted process must
  // apply them again rather than falling back to the server-wide settings.
  it('re-applies subagent models when a restarted session restores its thread model', async () => {
    const settings = new Map<string, unknown>();
    await createChannelSessionStartHook(
      makeStartDeps({ modelScope: 'user', userDefaultModel: 'openai/gpt-5.6-mini' }) as any,
    )(startArgs(makeSession({ settings })) as any);

    // The default changed since the thread started; the thread keeps its models.
    const restarted = makeSession({ settings });
    const restartDeps = makeStartDeps({ modelScope: 'user', userDefaultModel: 'openai/gpt-5.7-mini' });
    await createChannelSessionStartHook(restartDeps as any)(startArgs(restarted) as any);

    expect(restarted.model.switch).not.toHaveBeenCalled();
    expect(restartDeps.modelDefaults.get).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1' });
    expect(restarted.subagents.model.set.mock.calls.map(([arg]) => arg)).toEqual([
      { modelId: 'openai/gpt-5.6-mini', agentType: 'explore' },
      { modelId: 'openai/gpt-5.6-mini', agentType: 'plan' },
      { modelId: 'openai/gpt-5.6-mini', agentType: 'execute' },
    ]);
  });

  it("keeps observational memory invocation-scoped when applying the sender's model", async () => {
    const deps = makeStartDeps({
      modelScope: 'user',
      defaultModelId: 'openai/gpt-5.6',
      userDefaultModel: 'deepseek/deepseek-chat',
    });
    const session = makeSession();

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.om.observer.switchModel).not.toHaveBeenCalled();
    expect(session.om.reflector.switchModel).not.toHaveBeenCalled();
    expect(session.model.switch).toHaveBeenLastCalledWith('deepseek/deepseek-chat');
  });

  it('does not materialize observational memory when the sender model cannot be applied', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deps = makeStartDeps({
      modelScope: 'user',
      defaultModelId: 'anthropic/claude-opus-5',
      userDefaultModel: 'deepseek/deepseek-chat',
    });
    const session = makeSession({ currentModel: 'anthropic/claude-opus-5' });
    session.model.switch.mockRejectedValueOnce(new Error('missing credentials'));

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.om.observer.switchModel).not.toHaveBeenCalled();
    expect(session.om.reflector.switchModel).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[Factory Start] Failed to apply scoped default model', {
      modelId: 'deepseek/deepseek-chat',
      error: 'missing credentials',
    });
    warn.mockRestore();
  });

  // The point of persisting the choice: the thread keeps the model it started
  // on. A later process — where the sender's and factory defaults have both
  // moved on — must not retarget a conversation already under way.
  it('keeps the first model when a later start runs with changed defaults', async () => {
    const threadSettings = new Map<string, unknown>();
    const deps = makeStartDeps({ modelScope: 'user', userDefaultModel: 'openai/gpt-5.6' });

    await createChannelSessionStartHook(deps as any)(startArgs(makeSession({ settings: threadSettings })) as any);

    deps.modelDefaults.get.mockClear();
    deps.projects.getById.mockClear();
    deps.modelDefaults.get.mockResolvedValue({ modelId: 'openai/gpt-6' });
    deps.projects.getById.mockResolvedValue({
      id: 'fp-1',
      orgId: 'org-1',
      modelScope: 'factory',
      defaultModelId: 'anthropic/claude-opus-6',
    });
    const session = makeSession({ settings: threadSettings });

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.model.switch).not.toHaveBeenCalled();
    expect(deps.modelDefaults.get).not.toHaveBeenCalled();
    expect(session.restoredModel()).toBe('openai/gpt-5.6');
  });

  it("starts on the sender's default even when the factory has no default model", async () => {
    const deps = makeStartDeps({ modelScope: 'user', defaultModelId: null, userDefaultModel: 'openai/gpt-5.6' });
    const session = makeSession();

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.model.switch).toHaveBeenCalledTimes(1);
    expect(session.model.switch).toHaveBeenCalledWith('openai/gpt-5.6');
    expect(session.restoredModel()).toBe('openai/gpt-5.6');
  });

  it('does not cross-fallback to the factory model when the owner default lookup fails', async () => {
    const deps = makeStartDeps({
      modelScope: 'user',
      defaultLookupError: new Error('model defaults unavailable'),
    });
    const session = makeSession({ currentModel: 'openai/gpt-5.5' });

    await expect(createChannelSessionStartHook(deps as any)(startArgs(session) as any)).resolves.toBeUndefined();

    expect(session.model.switch).toHaveBeenCalledExactlyOnceWith('openai/gpt-5.5');
    expect(session.restoredModel()).toBe('openai/gpt-5.5');
  });

  it('leaves observational-memory settings for per-invocation resolution', async () => {
    const deps = makeStartDeps();
    const session = makeSession();

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.om.observer.switchModel).not.toHaveBeenCalled();
    expect(session.om.reflector.switchModel).not.toHaveBeenCalled();
    expect(session.state.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ observationThreshold: expect.anything() }),
    );
    expect(session.state.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ reflectionThreshold: expect.anything() }),
    );
  });

  // A restarted process restores the generation model from the thread. Memory
  // settings are resolved per invocation, so the restart does not apply them.
  it('migrates the legacy model on restart without applying memory settings', async () => {
    const deps = makeStartDeps({
      personalMemoryRecord: { reflectionThreshold: 333 },
    });
    const settings = new Map<string, unknown>([
      ['modeModelId_plan', 'openai/gpt-5.2-codex'],
      ['modeModelId_fast', 'cerebras/qwen-3-coder-480b'],
    ]);
    const session = makeSession({
      persistedModel: 'openai/gpt-5.5',
      persistedModeModel: 'deepseek/deepseek-chat',
      settings,
    });

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.om.observer.switchModel).not.toHaveBeenCalled();
    expect(session.om.reflector.switchModel).not.toHaveBeenCalled();
    // Still no model re-resolution: the migrated thread choice remains authoritative.
    expect(deps.modelDefaults.get).not.toHaveBeenCalled();
    expect(deps.projects.getById).toHaveBeenCalledWith({ id: 'fp-1' });
    expect(session.model.switch).not.toHaveBeenCalled();
    expect(session.restoredModel()).toBe('deepseek/deepseek-chat');
    expect(settings.get('modelPersistenceVersion')).toBe(2);
    expect(settings.has('modeModelId_build')).toBe(false);
    expect(settings.has('modeModelId_plan')).toBe(false);
    expect(settings.has('modeModelId_fast')).toBe(false);
  });

  // The durable record of a deliberate choice: either an earlier start or the
  // user's own switch. Re-applying a preference over it would undo the user's
  // selection every time the process restarts or another message arrives.
  it('leaves the model alone when the thread already has a current model persisted', async () => {
    const deps = makeStartDeps({ modelScope: 'user', userDefaultModel: 'openai/gpt-5.6' });
    const session = makeSession({ persistedModel: 'anthropic/claude-fable-5' });

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.model.switch).not.toHaveBeenCalled();
    // Scope is re-resolved for credential authority, but the thread's persisted
    // model remains authoritative and is not retargeted.
    expect(deps.modelDefaults.get).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1' });
    expect(deps.projects.getById).toHaveBeenCalledWith({ id: 'fp-1' });
    expect(session.restoredModel()).toBe('anthropic/claude-fable-5');
    // Scope and durable ownership still land even when the model is persisted.
    expect(session.state.set).toHaveBeenCalledWith({
      factoryProjectId: 'fp-1',
      factoryModelScope: 'user',
      factoryOwnerUserId: 'user-1',
    });
    expect(session.state.set).toHaveBeenCalledWith(expect.objectContaining({ factoryOrgId: 'org-1' }));
  });

  // An ungated dispatch marks the session unresolved above every guard. Owner
  // recovery is the resolution, so it has to take the marker down with it —
  // otherwise curation stays disabled for the life of the session over a stale flag.
  it('clears the unresolved marker when owner recovery resolves the organization', async () => {
    const deps = makeStartDeps();
    const session = makeSession();
    session.state.get = vi.fn(() => ({ factoryOrgUnresolved: true })) as any;

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgId: 'org-1', factoryOrgUnresolved: false });
  });

  // The org rung knowledge curation scopes on. `gateDispatch` stamps it on the
  // request context before the session exists, so it is in hand above every
  // guard below — and seeding it must not cost a storage read.
  const orgContext = (organizationId: unknown) => ({
    get: (key: string) => (key === 'user' ? { id: 'user-1', organizationId } : undefined),
  });

  it('seeds the organization on a chat-only thread, which reaches no other seam', async () => {
    const deps = makeStartDeps();
    const session = makeSession();

    await createChannelSessionStartHook(deps as any)({
      ...startArgs(session, 'channel:slack:C-1:1700.42'),
      requestContext: orgContext('org-1'),
    } as any);

    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgId: 'org-1' });
    expect(deps.sourceControl.sessions.getBySessionId).not.toHaveBeenCalled();
  });

  it('still seeds the organization when a mode model is already persisted', async () => {
    const deps = makeStartDeps();
    const session = makeSession({ persistedModeModel: 'anthropic/claude-fable-5' });

    await createChannelSessionStartHook(deps as any)({
      ...startArgs(session),
      requestContext: orgContext('org-1'),
    } as any);

    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgId: 'org-1' });
    // The guard still holds: the persisted mode model is left alone.
    expect(session.model.switch).not.toHaveBeenCalled();
  });

  it.each([
    ['no request context at all', undefined],
    ['a context whose user carries no org', orgContext(null)],
  ])('marks the session unresolved given %s', async (_label, requestContext) => {
    const deps = makeStartDeps();
    const session = makeSession();

    await createChannelSessionStartHook(deps as any)({
      ...startArgs(session, 'channel:slack:C-1:1700.42'),
      requestContext,
    } as any);

    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgUnresolved: true });
    expect(session.state.set).not.toHaveBeenCalledWith(expect.objectContaining({ factoryOrgId: expect.anything() }));
  });

  it('marks the session unresolved when the channel dependencies are absent', async () => {
    const session = makeSession();

    await createChannelSessionStartHook({} as any)({
      ...startArgs(session),
      requestContext: undefined,
    } as any);

    expect(session.state.set).toHaveBeenCalledWith({ factoryOrgUnresolved: true });
  });

  it('skips chat-only threads, whose resourceId names no project', async () => {
    const deps = makeStartDeps();
    const session = makeSession();

    await createChannelSessionStartHook(deps as any)(startArgs(session, 'channel:slack:C-1:1700.42') as any);

    expect(session.model.switch).not.toHaveBeenCalled();
    expect(deps.sourceControl.sessions.getBySessionId).not.toHaveBeenCalled();
    // Chat-only threads have no linked sender to read a pack for either.
    expect(deps.modelDefaults.get).not.toHaveBeenCalled();
  });

  it('configures nothing when the session row is gone', async () => {
    const deps = makeStartDeps({ session: null });
    const session = makeSession();

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.model.switch).not.toHaveBeenCalled();
    expect(deps.modelDefaults.get).not.toHaveBeenCalled();
  });

  // Nothing chose a model here, so the SDK's built-in mode default is the
  // thread's answer — recorded as such, because a future SDK that moves that
  // default must not silently retarget a conversation already under way.
  it('records the SDK mode default when neither a pack nor a factory default exists', async () => {
    const deps = makeStartDeps({ defaultModelId: null });
    const session = makeSession({ currentModel: 'openai/gpt-5.5' });

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.model.switch).toHaveBeenCalledExactlyOnceWith('openai/gpt-5.5');
    expect(session.restoredModel()).toBe('openai/gpt-5.5');
  });

  it("records a connected provider's default model, for the main model and every subagent, when the mode default has no credential", async () => {
    providerDefault.mockResolvedValueOnce('anthropic/claude-fable-5');
    const deps = makeStartDeps({ defaultModelId: null });
    const session = makeSession({ currentModel: 'openai/gpt-5.5' });

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(providerDefault).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1' }), 'openai/gpt-5.5');
    expect(session.model.switch).toHaveBeenCalledExactlyOnceWith('anthropic/claude-fable-5');
    expect(session.restoredModel()).toBe('anthropic/claude-fable-5');
    for (const agentType of ['explore', 'plan', 'execute']) {
      await expect(session.thread.getSetting({ key: `slackSubagentModelId_${agentType}` })).resolves.toBe(
        'anthropic/claude-fable-5',
      );
    }
  });

  it('pins subagents to the running model when the selected model is rejected', async () => {
    providerDefault.mockResolvedValueOnce('anthropic/claude-fable-5');
    const deps = makeStartDeps({ defaultModelId: null });
    const session = makeSession({ currentModel: 'openai/gpt-5.5' });
    session.model.switch.mockRejectedValueOnce(new Error('unknown model'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await createChannelSessionStartHook(deps as any)(startArgs(session) as any);
    } finally {
      warn.mockRestore();
    }

    for (const agentType of ['explore', 'plan', 'execute']) {
      await expect(session.thread.getSetting({ key: `slackSubagentModelId_${agentType}` })).resolves.toBe(
        'openai/gpt-5.5',
      );
    }
  });

  it('records nothing when the session has no model to record', async () => {
    const deps = makeStartDeps({ defaultModelId: null });
    const session = makeSession({ currentModel: '' });

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.model.switch).not.toHaveBeenCalled();
    expect(session.restoredModel()).toBe(null);
  });
});

describe('Slack aside ingest', () => {
  function makeAside(text = 'aside: looks good to me') {
    return {
      id: '1700.99',
      author: { userId: 'U-sender', userName: 'caleb', fullName: 'Caleb Stone', isBot: false },
      text,
      metadata: { dateSent: new Date('2026-08-30T10:00:00.000Z'), edited: false },
      raw: { team_id: 'T-1' },
    } as any;
  }

  function makeAsideDeps({
    link = { orgId: 'org-1', userId: 'user-1' } as { orgId?: string; userId: string } | null,
  } = {}) {
    const thread = makeThread();
    thread.id = 'slack:C-1:1700.42';
    thread.post = vi.fn();
    return {
      thread,
      deps: {
        accountLinks: {
          getAccountLink: vi.fn().mockResolvedValue(link),
          setDefaultFactory: vi.fn().mockResolvedValue(true),
        } as any,
        projects: makeProjects([{ id: 'fp-1' }]) as any,
        workItems: {
          getBySource: vi.fn().mockResolvedValue({ id: 'wi-1', orgId: 'org-1', factoryProjectId: 'fp-1' }),
        } as any,
        feed: { createComment: vi.fn().mockResolvedValue({ status: 'created' }) },
      },
    };
  }

  it('lands a linked sender aside on the card the thread created, attributed to their tenant user', async () => {
    const { thread, deps } = makeAsideDeps();
    const defaultHandler = vi.fn();

    await createHandlers(deps as any).onSubscribedMessage!(thread, makeAside(), defaultHandler, handlerCtx());

    // Never dispatched: an aside is human talk the agent must not answer.
    expect(defaultHandler).not.toHaveBeenCalled();
    // Scoped by the sending workspace: a channel id and a `ts` only identify a
    // thread inside the team that issued them.
    expect(deps.workItems.getBySource).toHaveBeenCalledWith({
      integrationId: 'slack',
      type: 'slack-thread',
      workspaceId: 'T-1',
      externalId: 'slack:C-1:1700.42',
    });
    expect(deps.feed.createComment).toHaveBeenCalledTimes(1);
    expect(deps.feed.createComment.mock.calls[0][0]).toMatchObject({
      orgId: 'org-1',
      workItemId: 'wi-1',
      // The leading `aside` marker is Slack routing, not part of what was said.
      body: 'looks good to me',
      author: { kind: 'user', id: 'user-1', displayName: 'Caleb Stone' },
      occurredAt: new Date('2026-08-30T10:00:00.000Z'),
      externalSource: { integrationId: 'slack', type: 'message', workspaceId: 'T-1', externalId: 'C-1:1700.99' },
    });

    // The next real message still belongs to the agent alone: it already shows
    // in the bound transcript, so a comment would say the same thing twice.
    await createHandlers(deps as any).onSubscribedMessage!(
      thread,
      makeAside('ship it'),
      defaultHandler,
      handlerCtx(chatOnlyMastra()),
    );
    expect(defaultHandler).toHaveBeenCalledTimes(1);
    expect(deps.feed.createComment).toHaveBeenCalledTimes(1);
  });

  it('lands the emoji the sender typed, and leaves a custom workspace emoji as written', async () => {
    const { thread, deps } = makeAsideDeps();

    await createHandlers(deps as any).onSubscribedMessage!(
      thread,
      makeAside('aside: nice :thumbsup::skin-tone-3: — ship it :party-parrot:'),
      vi.fn(),
      handlerCtx(),
    );

    expect(deps.feed.createComment.mock.calls[0][0].body).toBe('nice 👍🏼 — ship it :party-parrot:');
  });

  it('stores an unlinked sender aside under their Slack identity, silently (no Connect card)', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const { thread, deps } = makeAsideDeps({ link: null });

    await createHandlers(deps as any).onSubscribedMessage!(thread, makeAside(), vi.fn(), handlerCtx());

    expect(thread.postEphemeral).not.toHaveBeenCalled();
    expect(deps.feed.createComment.mock.calls[0][0].author).toMatchObject({
      kind: 'user',
      id: 'slack:U-sender',
      displayName: 'Caleb Stone',
    });
  });

  it('still lands an aside on a card keyed before the workspace joined the key', async () => {
    const { thread, deps } = makeAsideDeps();
    deps.workItems.getBySource = vi.fn(async (source: ExternalWorkItemSource) =>
      source.workspaceId ? null : { id: 'wi-legacy', orgId: 'org-1', factoryProjectId: 'fp-1' },
    );

    await createHandlers(deps as any).onSubscribedMessage!(thread, makeAside(), vi.fn(), handlerCtx());

    expect(deps.feed.createComment.mock.calls[0][0].workItemId).toBe('wi-legacy');
  });

  it('ingests nothing when the thread has no card', async () => {
    const { thread, deps } = makeAsideDeps();
    deps.workItems.getBySource = vi.fn().mockResolvedValue(null);
    const defaultHandler = vi.fn();

    await createHandlers(deps as any).onSubscribedMessage!(thread, makeAside(), defaultHandler, handlerCtx());

    // Scoped key, then the pre-workspace one.
    expect(deps.workItems.getBySource).toHaveBeenCalledTimes(2);
    expect(deps.feed.createComment).not.toHaveBeenCalled();
    expect(defaultHandler).not.toHaveBeenCalled();
  });

  it('never lets an ingest failure reach the Slack thread', async () => {
    const { thread, deps } = makeAsideDeps();
    deps.feed.createComment = vi.fn().mockRejectedValue(new Error('storage down'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      createHandlers(deps as any).onSubscribedMessage!(thread, makeAside(), vi.fn(), handlerCtx()),
    ).resolves.toBeUndefined();
    expect(deps.feed.createComment).toHaveBeenCalledTimes(1);
    expect(thread.post).not.toHaveBeenCalled();
  });
});
