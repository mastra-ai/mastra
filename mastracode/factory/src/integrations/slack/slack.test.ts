import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createChannelResourceIdResolver,
  resolveChannelThreadId,
  adaptSourceControlOwner,
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
    // Addressed to the sender, not the channel: the card is a private nudge.
    const [user, , options] = thread.postEphemeral.mock.calls[0];
    expect(user).toEqual({ userId: 'U-sender', userName: 'caleb' });
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

function makeProjects(factories: Array<{ id: string; name?: string; slackWorkItemsEnabled?: boolean }>) {
  const projects = factories.map(factory => ({ slackWorkItemsEnabled: false, ...factory }));
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

    expect(result).toEqual({ status: 'resolved', factoryProjectId: 'fp-2', slackWorkItemsEnabled: false });
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

    expect(result).toEqual({ status: 'resolved', factoryProjectId: 'fp-only', slackWorkItemsEnabled: false });
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
    expect(linkButton.url).toBe('https://mc.example.com/settings/connections');
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

describe('Slack thread work-item creation', () => {
  function makeWorkItemDeps({
    link = { orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fp-1' } as {
      orgId?: string;
      userId: string;
      defaultFactoryProjectId?: string;
    } | null,
    internalThread = { id: 'uuid-thread-1', resourceId: 'us-42' } as { id: string; resourceId: string } | null,
    projects = makeProjects([{ id: 'fp-1', slackWorkItemsEnabled: true }]) as any,
    upsert = vi.fn().mockResolvedValue({ created: true }),
  } = {}) {
    const accountLinks = {
      getAccountLink: vi.fn().mockResolvedValue(link),
      setDefaultFactory: vi.fn().mockResolvedValue(true),
    } as any;
    const store = {
      listThreads: vi.fn().mockResolvedValue({ threads: internalThread ? [internalThread] : [] }),
    };
    const mastra = { getStorage: () => ({ getStore: () => Promise.resolve(store) }) };
    const workItems = { upsert } as any;
    return { accountLinks, projects, mastra, workItems, upsert };
  }

  function makeWorkItemThread() {
    const thread = makeThread();
    thread.id = 'slack:C-1:1700.42';
    thread.isSubscribed = vi.fn().mockResolvedValue(false);
    thread.post = vi.fn();
    return thread;
  }

  it('a routed DM creates an execute-stage work item bound to the Factory session', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const deps = makeWorkItemDeps();
    const handlers = createHandlers(deps as any);
    const thread = makeWorkItemThread();

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn(), handlerCtx(deps.mastra));

    expect(deps.upsert).toHaveBeenCalledTimes(1);
    const call = deps.upsert.mock.calls[0][0];
    expect(call.factoryProjectId).toBe('fp-1');
    expect(call.orgId).toBe('org-1');
    expect(call.userId).toBe('user-1');
    expect(call.input.stages).toEqual(['execute']);
    expect(call.input.externalSource.integrationId).toBe('slack');
    expect(call.input.externalSource.type).toBe('slack-thread');
    expect(call.input.externalSource.externalId).toBe('slack:C-1:1700.42');
    expect(call.input.sessions.chat.sessionId).toBe('us-42');
    expect(call.input.sessions.chat.branch).toBe('slack/1700-42');
    expect(call.input.sessions.chat.threadId).toBe('uuid-thread-1');

    // The work-item url and the card's button url read one shared deepLink —
    // assert they are byte-identical so the two can never drift.
    const card = thread.post.mock.calls[0][0];
    const actions = card.children.find((c: any) => c.type === 'actions');
    expect(call.input.externalSource.url).toBe(actions.children[0].url);
  });

  it('a routed @-mention also creates an execute-stage work item (no per-origin split)', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const deps = makeWorkItemDeps();
    const handlers = createHandlers(deps as any);
    const thread = makeWorkItemThread();

    await handlers.onMention!(thread, makeMessage('T-1'), vi.fn(), handlerCtx(deps.mastra));

    expect(deps.upsert).toHaveBeenCalledTimes(1);
    const call = deps.upsert.mock.calls[0][0];
    expect(call.input.stages).toEqual(['execute']);
    expect(call.input.externalSource.type).toBe('slack-thread');
  });

  it('upserts in preserve mode so a repeat message never resurrects a moved card', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const deps = makeWorkItemDeps();
    const handlers = createHandlers(deps as any);
    const thread = makeWorkItemThread();

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn(), handlerCtx(deps.mastra));

    expect(deps.upsert.mock.calls[0][0].reuseMode).toBe('preserve');
  });

  it('a Factory with Slack work-item creation disabled starts the session without creating a work item', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const deps = makeWorkItemDeps({ projects: makeProjects([{ id: 'fp-1', slackWorkItemsEnabled: false }]) });
    const handlers = createHandlers(deps as any);
    const thread = makeWorkItemThread();
    const defaultHandler = vi.fn();

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), defaultHandler, handlerCtx(deps.mastra));

    expect(defaultHandler).toHaveBeenCalledTimes(1);
    expect(deps.upsert).not.toHaveBeenCalled();
  });

  it('an unrouted sender creates no work item', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    // No projects domain → gate passes without routing (gate.routed absent).
    const deps = makeWorkItemDeps({ projects: null as any });
    const handlers = createHandlers(deps as any);
    const thread = makeWorkItemThread();

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn(), handlerCtx(deps.mastra));

    expect(deps.upsert).not.toHaveBeenCalled();
  });

  it('a routed follow-up (already subscribed) creates no work item', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const deps = makeWorkItemDeps();
    const handlers = createHandlers(deps as any);
    const thread = makeWorkItemThread();
    thread.isSubscribed = vi.fn().mockResolvedValue(true);

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn(), handlerCtx(deps.mastra));

    expect(deps.upsert).not.toHaveBeenCalled();
  });

  it('a chat-only (channel:) resourceId creates the item with no session binding', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const deps = makeWorkItemDeps({ internalThread: { id: 'uuid-thread-1', resourceId: 'channel:slack:C-1:1700.42' } });
    const handlers = createHandlers(deps as any);
    const thread = makeWorkItemThread();

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn(), handlerCtx(deps.mastra));

    expect(deps.upsert).toHaveBeenCalledTimes(1);
    const call = deps.upsert.mock.calls[0][0];
    expect(call.input.stages).toEqual(['execute']);
    expect(call.input.sessions).toBeUndefined();
  });

  it('a work-item failure is swallowed and does not abort the run (card still posts)', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const upsert = vi.fn().mockRejectedValue(new Error('db down'));
    const deps = makeWorkItemDeps({ upsert });
    const handlers = createHandlers(deps as any);
    const thread = makeWorkItemThread();

    await expect(
      handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn(), handlerCtx(deps.mastra)),
    ).resolves.toBeUndefined();

    expect(thread.post).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });
});

/**
 * The adapter between the factory's source-control storage handle and the
 * narrow surface the Slack handlers consume. Most of it delegates, but repo
 * resolution encodes real policy — which connection counts, which repo, and
 * what the base branch is — so it gets tested against a stubbed owner rather
 * than through the handlers, which stub the adapted surface instead.
 */
describe('adaptSourceControlOwner', () => {
  function makeOwner({
    connections = [{ id: 'conn-gh', integrationId: 'github' }],
    projectRepositories = [{ id: 'pr-1', repositoryId: 'repo-1', branch: null }] as Array<{
      id: string;
      repositoryId: string;
      branch?: string | null;
    }>,
    repository = { defaultBranch: 'main' } as { defaultBranch: string } | null,
  } = {}) {
    return {
      integrationId: 'github',
      connections: { list: vi.fn().mockResolvedValue(connections) },
      projectRepositories: { list: vi.fn().mockResolvedValue(projectRepositories) },
      repositories: { get: vi.fn().mockResolvedValue(repository) },
      sessions: {
        getForBranch: vi.fn().mockResolvedValue({ sessionId: 'us-existing' }),
        create: vi.fn(input => Promise.resolve({ sessionId: input.sessionId })),
      },
    };
  }

  const resolveArgs = { orgId: 'org-1', factoryProjectId: 'fp-1' };

  it('resolves the first repository linked to the owner-owned connection, defaulting the base branch to the repo default', async () => {
    const owner = makeOwner();

    const result = await adaptSourceControlOwner(owner as any).resolveProjectRepository(resolveArgs);

    expect(result).toEqual({ projectRepositoryId: 'pr-1', baseBranch: 'main' });
    expect(owner.projectRepositories.list).toHaveBeenCalledWith({ orgId: 'org-1', connectionId: 'conn-gh' });
    expect(owner.repositories.get).toHaveBeenCalledWith({ orgId: 'org-1', id: 'repo-1' });
  });

  it('prefers the branch pinned on the project repository over the repository default', async () => {
    const owner = makeOwner({ projectRepositories: [{ id: 'pr-1', repositoryId: 'repo-1', branch: 'develop' }] });

    const result = await adaptSourceControlOwner(owner as any).resolveProjectRepository(resolveArgs);

    expect(result).toEqual({ projectRepositoryId: 'pr-1', baseBranch: 'develop' });
  });

  // A project can carry connections for several integrations; only the one
  // belonging to this owner can back a session.
  it('ignores connections belonging to other integrations', async () => {
    const owner = makeOwner({ connections: [{ id: 'conn-linear', integrationId: 'linear' }] });

    expect(await adaptSourceControlOwner(owner as any).resolveProjectRepository(resolveArgs)).toBeNull();
    expect(owner.projectRepositories.list).not.toHaveBeenCalled();
  });

  it('resolves nothing when the connection has no linked repository', async () => {
    const owner = makeOwner({ projectRepositories: [] });

    expect(await adaptSourceControlOwner(owner as any).resolveProjectRepository(resolveArgs)).toBeNull();
    expect(owner.repositories.get).not.toHaveBeenCalled();
  });

  it('resolves nothing when the linked repository row is missing', async () => {
    const owner = makeOwner({ repository: null });

    expect(await adaptSourceControlOwner(owner as any).resolveProjectRepository(resolveArgs)).toBeNull();
  });

  it('delegates branch lookup to the owner unchanged', async () => {
    const owner = makeOwner();
    const args = { projectRepositoryId: 'pr-1', userId: 'user-1', branch: 'slack/thread-1' };

    const session = await adaptSourceControlOwner(owner as any).getSessionForBranch(args);

    expect(session).toEqual({ sessionId: 'us-existing' });
    expect(owner.sessions.getForBranch).toHaveBeenCalledWith(args);
  });

  // The storage handle requires a session id the caller shouldn't invent, so
  // the adapter mints one.
  it('mints a session id when creating a session', async () => {
    const owner = makeOwner();
    const args = {
      projectRepositoryId: 'pr-1',
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'slack/thread-1',
      baseBranch: 'main',
    };

    const session = await adaptSourceControlOwner(owner as any).createSession(args);

    expect(owner.sessions.create).toHaveBeenCalledWith(expect.objectContaining(args));
    expect(session.sessionId).toEqual(expect.any(String));
    expect(session.sessionId).not.toHaveLength(0);
  });
});
