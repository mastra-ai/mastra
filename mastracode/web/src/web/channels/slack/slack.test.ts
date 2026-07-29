import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createChannelResourceIdResolver,
  resolveChannelThreadId,
  createHandlers,
  resolveLinkedSender,
  resolveFactoryForLink,
} from './slack.js';

/**
 * The 4th argument core hands every channel handler. The handlers write the
 * resolved tenant onto `requestContext`, so tests that drive them must pass a
 * real one — a bare `{}` throws once the sender resolves as linked.
 */
function handlerCtx(mastra?: unknown) {
  return { mastra: mastra as any, requestContext: new RequestContext() };
}

function makeThread() {
  return {
    adapter: { name: 'slack' },
    channelId: 'C-1',
    postEphemeral: vi.fn().mockResolvedValue({ id: 'eph-1' }),
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
    const [user, , options] = thread.postEphemeral.mock.calls[0];
    expect(user).toEqual(thread.postEphemeral.mock.calls[0][0]);
    expect(options).toEqual({ fallbackToDM: true });

    // The link carries NO identity: Slack proves the account during OIDC, so
    // a forwarded card can't bind the original sender to whoever clicks it.
    const card = thread.postEphemeral.mock.calls[0][1];
    const actions = card.children.find((c: any) => c.type === 'actions');
    const linkButton = actions.children.find((c: any) => c.type === 'link-button');
    expect(linkButton.url).toBe('https://mc.example.com/connect/slack');
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
  return {
    get: vi.fn(async ({ id }: { id: string }) => factories.find(f => f.id === id) ?? null),
    list: vi.fn(async () => factories),
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
      message: makeMessage('T-1'),
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
      message: makeMessage('T-1'),
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
      message: makeMessage('T-1'),
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
      message: makeMessage('T-1'),
      link: { orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fp-gone', linkedAt: new Date() },
      key: linkKey,
      accountLinks,
      projects,
    });

    expect(result).toEqual({ status: 'blocked' });
    // Ephemeral prompt deep-links to Connected Accounts settings.
    const card = thread.postEphemeral.mock.calls[0][1];
    const actions = card.children.find((c: any) => c.type === 'actions');
    const linkButton = actions.children.find((c: any) => c.type === 'link-button');
    expect(linkButton.url).toBe('https://mc.example.com/settings/connected-accounts');
    expect(accountLinks.setDefaultFactory).not.toHaveBeenCalled();
  });

  it('multiple factories with no default prompts and blocks the run', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeThread();
    const projects = makeProjects([{ id: 'fp-1' }, { id: 'fp-2' }]);

    const result = await resolveFactoryForLink({
      thread,
      message: makeMessage('T-1'),
      link: { orgId: 'org-1', userId: 'user-1', linkedAt: new Date() },
      key: linkKey,
      accountLinks: makeLinkStore(),
      projects,
    });

    expect(result).toEqual({ status: 'blocked' });
    expect(thread.postEphemeral).toHaveBeenCalledTimes(1);
    expect(thread.postEphemeral.mock.calls[0][2]).toEqual({ fallbackToDM: true });
  });

  it('a personal account (no org) has no factories and is prompted', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeThread();
    const projects = makeProjects([{ id: 'fp-1' }]);

    const result = await resolveFactoryForLink({
      thread,
      message: makeMessage('T-1'),
      link: { userId: 'user-1', linkedAt: new Date() },
      key: linkKey,
      accountLinks: makeLinkStore(),
      projects,
    });

    expect(result).toEqual({ status: 'blocked' });
    // Org-less: never lists factories (they're org-scoped).
    expect(projects.list).not.toHaveBeenCalled();
    expect(thread.postEphemeral).toHaveBeenCalledTimes(1);
  });

  it('blocks without a card when no public URL is configured', async () => {
    delete process.env.MASTRACODE_CHANNELS_PUBLIC_URL;
    delete process.env.MASTRACODE_PUBLIC_URL;
    const thread = makeThread();
    const projects = makeProjects([{ id: 'fp-1' }, { id: 'fp-2' }]);

    const result = await resolveFactoryForLink({
      thread,
      message: makeMessage('T-1'),
      link: { orgId: 'org-1', userId: 'user-1', linkedAt: new Date() },
      key: linkKey,
      accountLinks: makeLinkStore(),
      projects,
    });

    expect(result).toEqual({ status: 'blocked' });
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

    const ctx = handlerCtx();
    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, ctx);

    expect(defaultHandler).toHaveBeenCalledTimes(1);
    expect(thread.postEphemeral).not.toHaveBeenCalled();
    // The run must carry the linked tenant, or it resolves default credentials.
    expect(ctx.requestContext.get('user')).toEqual({ id: 'user-1', organizationId: 'org-1' });
  });

  it('stamps the tenant for a linked sender even when factory routing is ungated', async () => {
    // The silent-failure path: with no `projects` dep, `resolveFactoryForLink`
    // returns `ungated`, so this sender leaves the gate without a routed
    // result. A stamp written in the routed branch would be skipped here and
    // the sender would run on default credentials with nothing to show for it.
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'user-1' });
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks });

    const ctx = handlerCtx();
    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, ctx);

    expect(defaultHandler).toHaveBeenCalledTimes(1);
    expect(ctx.requestContext.get('user')).toEqual({ id: 'user-1', organizationId: 'org-1' });
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
    expect(thread.postEphemeral).toHaveBeenCalledTimes(1);
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
    expect(thread.postEphemeral).toHaveBeenCalledTimes(1);
  });

  it('keeps pre-routing behavior when only account linking is configured (no projects)', async () => {
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'user-1' });
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ accountLinks });

    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler, handlerCtx());

    expect(defaultHandler).toHaveBeenCalledTimes(1);
  });
});

describe('repo-backed thread sessions (resolveResourceId)', () => {
  function makeSourceControl({
    existingSession = null as { sessionId: string } | null,
    repo = { projectRepositoryId: 'pr-1', baseBranch: 'main' } as {
      projectRepositoryId: string;
      baseBranch: string;
    } | null,
  } = {}) {
    return {
      resolveProjectRepository: vi.fn().mockResolvedValue(repo),
      getSessionForBranch: vi.fn().mockResolvedValue(existingSession),
      createSession: vi.fn().mockResolvedValue({ sessionId: 'us-new' }),
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

  const resolveArgs = (thread = { id: 'slack:C-1:1700.42' }) => ({
    platform: 'slack',
    thread: thread as any,
    message: makeMessage('T-1'),
    defaultResourceId: 'slack:U-sender',
  });

  it('a linked sender with a repo-backed factory gets a user-session id, row created with repo + thread branch', async () => {
    const deps = makeResolverDeps();
    const resolve = createChannelResourceIdResolver(deps as any);

    await expect(resolve(resolveArgs())).resolves.toBe('us-new');

    expect(deps.sourceControl.resolveProjectRepository).toHaveBeenCalledWith({
      orgId: 'org-1',
      factoryProjectId: 'fp-1',
    });
    expect(deps.sourceControl.createSession).toHaveBeenCalledWith({
      projectRepositoryId: 'pr-1',
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'slack/1700-42',
      baseBranch: 'main',
    });
  });

  it('a repeat message on the same thread reuses the existing session, no second row', async () => {
    const sourceControl = makeSourceControl({ existingSession: { sessionId: 'us-existing' } });
    const deps = makeResolverDeps({ sourceControl });
    const resolve = createChannelResourceIdResolver(deps as any);

    await expect(resolve(resolveArgs())).resolves.toBe('us-existing');

    expect(sourceControl.getSessionForBranch).toHaveBeenCalledWith({
      projectRepositoryId: 'pr-1',
      userId: 'user-1',
      branch: 'slack/1700-42',
    });
    expect(sourceControl.createSession).not.toHaveBeenCalled();
  });

  it('no sourceControl → chat-only channel resourceId', async () => {
    const { sourceControl: _unused, ...deps } = makeResolverDeps();
    const resolve = createChannelResourceIdResolver(deps as any);

    await expect(resolve(resolveArgs())).resolves.toBe('channel:slack:C-1:1700.42');
  });

  it('a factory without a repository falls back to a chat-only session', async () => {
    const sourceControl = makeSourceControl({ repo: null });
    const deps = makeResolverDeps({ sourceControl });
    const resolve = createChannelResourceIdResolver(deps as any);

    await expect(resolve(resolveArgs())).resolves.toBe('channel:slack:C-1:1700.42');
    expect(sourceControl.createSession).not.toHaveBeenCalled();
  });

  it('an unlinked sender stays chat-only and creates no session row', async () => {
    const sourceControl = makeSourceControl();
    const deps = makeResolverDeps({ link: null, sourceControl });
    const resolve = createChannelResourceIdResolver(deps as any);

    await expect(resolve(resolveArgs())).resolves.toBe('channel:slack:C-1:1700.42');
    expect(sourceControl.resolveProjectRepository).not.toHaveBeenCalled();
    expect(sourceControl.createSession).not.toHaveBeenCalled();
  });

  it('a source-control failure falls back to chat-only instead of dropping the message', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sourceControl = makeSourceControl();
    sourceControl.createSession.mockRejectedValue(new Error('db down'));
    const deps = makeResolverDeps({ sourceControl });
    const resolve = createChannelResourceIdResolver(deps as any);

    await expect(resolve(resolveArgs())).resolves.toBe('channel:slack:C-1:1700.42');
    expect(warn).toHaveBeenCalled();
  });
});

describe('repo-backed thread ids (resolveThreadId)', () => {
  it('a repo-backed thread takes the session id as its thread id (web convention: threadId = sessionId)', () => {
    expect(resolveChannelThreadId({ resourceId: 'us-new', defaultThreadId: 'uuid-1' } as any)).toBe('us-new');
  });

  it('a chat-only thread keeps the default random id', () => {
    expect(resolveChannelThreadId({ resourceId: 'channel:slack:C-1:1700.42', defaultThreadId: 'uuid-1' } as any)).toBe(
      'uuid-1',
    );
  });
});

describe('View Session card link', () => {
  function makeCardDeps({
    link = { orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fp-1' },
    internalThread = { id: 'uuid-thread-1', resourceId: 'channel:slack:C-1:1700.42' },
    projects = makeProjects([{ id: 'fp-1' }]),
  }: {
    link?: { orgId?: string; userId: string; defaultFactoryProjectId?: string } | null;
    internalThread?: { id: string; resourceId: string } | null;
    projects?: any;
  } = {}) {
    const accountLinks = {
      getAccountLink: vi.fn().mockResolvedValue(link),
      setDefaultFactory: vi.fn().mockResolvedValue(true),
    } as any;
    const store = {
      listThreads: vi.fn().mockResolvedValue({ threads: internalThread ? [internalThread] : [] }),
    };
    const mastra = { getStorage: () => ({ getStore: () => Promise.resolve(store) }) };
    return { accountLinks, projects, mastra };
  }

  function makeCardThread() {
    const thread = makeThread();
    thread.id = 'slack:C-1:1700.42';
    thread.isSubscribed = vi.fn().mockResolvedValue(false);
    thread.post = vi.fn();
    return thread;
  }

  it('a repo-backed thread deep-links to the user-session workspace route with no resourceId param', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const deps = makeCardDeps({ internalThread: { id: 'uuid-thread-1', resourceId: 'us-42' } });
    const handlers = createHandlers(deps as any);
    const thread = makeCardThread();

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn(), handlerCtx(deps.mastra));

    expect(thread.post).toHaveBeenCalledTimes(1);
    const card = thread.post.mock.calls[0][0];
    const actions = card.children.find((c: any) => c.type === 'actions');
    // The workspace segment already IS the resourceId — the param would duplicate it.
    expect(actions.children[0].url).toBe(
      'https://mc.example.com/factories/fp-1/workspaces/us-42/threads/uuid-thread-1',
    );
    expect(actions.children[0].url).not.toContain('resourceId=');
  });

  it('an unrouted repo-backed thread keeps the param, having no workspace segment to carry it', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    // Repo-backed resourceId AND no routing: isolates the `!gate.routed` half of
    // the predicate, which the chat-only unrouted case below cannot distinguish.
    const { projects: _unused, ...deps } = makeCardDeps({
      internalThread: { id: 'uuid-thread-1', resourceId: 'us-42' },
    });
    const handlers = createHandlers(deps as any);
    const thread = makeCardThread();

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn(), handlerCtx(deps.mastra));

    const card = thread.post.mock.calls[0][0];
    const actions = card.children.find((c: any) => c.type === 'actions');
    expect(actions.children[0].url).toBe('https://mc.example.com/threads/uuid-thread-1?resourceId=us-42');
  });

  it('a chat-only thread keeps the channel workspace segment', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const deps = makeCardDeps();
    const handlers = createHandlers(deps as any);
    const thread = makeCardThread();

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn(), handlerCtx(deps.mastra));

    const card = thread.post.mock.calls[0][0];
    const actions = card.children.find((c: any) => c.type === 'actions');
    expect(actions.children[0].url).toBe(
      'https://mc.example.com/factories/fp-1/workspaces/channel/threads/uuid-thread-1' +
        `?resourceId=${encodeURIComponent('channel:slack:C-1:1700.42')}`,
    );
  });

  it('an unrouted sender falls back to the factory-agnostic redirect', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    // No projects domain → gate passes without routing (pre-routing behavior).
    const { projects: _unused, ...deps } = makeCardDeps();
    const handlers = createHandlers(deps as any);
    const thread = makeCardThread();

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn(), handlerCtx(deps.mastra));

    const card = thread.post.mock.calls[0][0];
    const actions = card.children.find((c: any) => c.type === 'actions');
    expect(actions.children[0].url).toBe(
      `https://mc.example.com/threads/uuid-thread-1?resourceId=${encodeURIComponent('channel:slack:C-1:1700.42')}`,
    );
  });
});
