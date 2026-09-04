import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExternalWorkItemSource } from '../../storage/domains/work-items/base.js';
import {
  createChannelResourceIdResolver,
  createChannelSessionStartHook,
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
  // Shaped like the real `SourceControlStorageHandle` the Slack wiring now
  // consumes directly: repo resolution is the shared factory-session helper,
  // so the stub has to answer the same row lookups it makes.
  function makeSourceControl({ existingSession = null as { sessionId: string } | null, hasRepo = true } = {}) {
    return {
      integrationId: 'github',
      connections: {
        list: vi.fn().mockResolvedValue([{ id: 'conn-gh', integrationId: 'github', createdByUserId: 'owner-1' }]),
      },
      projectRepositories: {
        list: vi.fn().mockResolvedValue(hasRepo ? [{ id: 'pr-1', repositoryId: 'repo-1', branch: null }] : []),
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

    expect(deps.sourceControl.connections.list).toHaveBeenCalledWith({
      orgId: 'org-1',
      factoryProjectId: 'fp-1',
    });
    // Attributed to the Slack sender, not to whoever connected the repository.
    expect(deps.sourceControl.sessions.create).toHaveBeenCalledWith({
      sessionId: expect.any(String),
      projectRepositoryId: 'pr-1',
      orgId: 'org-1',
      userId: 'user-1',
      branch: 'slack/1700-42',
      baseBranch: 'main',
      visibility: 'org',
    });
  });

  it('a DM thread creates a private session; channel threads stay org-visible', async () => {
    const deps = makeResolverDeps();
    const resolve = createChannelResourceIdResolver(deps as any);

    await expect(resolve(resolveArgs({ id: 'slack:D-1:1700.42', isDM: true } as any))).resolves.toBe('us-new');

    expect(deps.sourceControl.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'private' }),
    );
  });

  // Top-level DM and channel conversations use the empty-threadTs thread form
  // (`slack:D-1:`), which previously derived the invalid git ref `slack/` and
  // made every top-level DM session fail its clone.
  it.each([
    { id: 'slack:D-1:', branch: 'slack/D-1' },
    { id: 'slack:C-1:', branch: 'slack/C-1' },
  ])('a top-level conversation thread (empty threadTs) derives its branch from the channel id ($id)', async ({ id, branch }) => {
    const deps = makeResolverDeps();
    const resolve = createChannelResourceIdResolver(deps as any);

    await expect(resolve(resolveArgs({ id }))).resolves.toBe('us-new');

    expect(deps.sourceControl.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ branch }));
  });

  it('a repeat message on the same thread reuses the existing session, no second row', async () => {
    const sourceControl = makeSourceControl({ existingSession: { sessionId: 'us-existing' } });
    const deps = makeResolverDeps({ sourceControl });
    const resolve = createChannelResourceIdResolver(deps as any);

    await expect(resolve(resolveArgs())).resolves.toBe('us-existing');

    expect(sourceControl.sessions.getForBranch).toHaveBeenCalledWith({
      projectRepositoryId: 'pr-1',
      userId: 'user-1',
      branch: 'slack/1700-42',
    });
    expect(sourceControl.sessions.create).not.toHaveBeenCalled();
  });

  it('no sourceControl → chat-only channel resourceId', async () => {
    const { sourceControl: _unused, ...deps } = makeResolverDeps();
    const resolve = createChannelResourceIdResolver(deps as any);

    await expect(resolve(resolveArgs())).resolves.toBe('channel:slack:C-1:1700.42');
  });

  it('a factory without a repository falls back to a chat-only session', async () => {
    const sourceControl = makeSourceControl({ hasRepo: false });
    const deps = makeResolverDeps({ sourceControl });
    const resolve = createChannelResourceIdResolver(deps as any);

    await expect(resolve(resolveArgs())).resolves.toBe('channel:slack:C-1:1700.42');
    expect(sourceControl.sessions.create).not.toHaveBeenCalled();
  });

  it('an unlinked sender stays chat-only and creates no session row', async () => {
    const sourceControl = makeSourceControl();
    const deps = makeResolverDeps({ link: null, sourceControl });
    const resolve = createChannelResourceIdResolver(deps as any);

    await expect(resolve(resolveArgs())).resolves.toBe('channel:slack:C-1:1700.42');
    expect(sourceControl.connections.list).not.toHaveBeenCalled();
    expect(sourceControl.sessions.create).not.toHaveBeenCalled();
  });

  it('a source-control failure falls back to chat-only instead of dropping the message', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sourceControl = makeSourceControl();
    sourceControl.sessions.create.mockRejectedValue(new Error('db down'));
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
    // Same key shape the aside lookup rebuilds, workspace included.
    expect(call.input.externalSource.workspaceId).toBe('T-1');
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
 * Sessions created by the channel machinery are configured here or nowhere.
 * Without this hook a Slack session runs on the SDK's built-in mode default
 * (`openai/gpt-5.5`), so a factory pointed at any other provider fails every
 * message with a missing-credentials error.
 */
describe('session start (onSessionStart)', () => {
  function makeSession({ persistedModeModel = null as string | null, mode = 'build' } = {}) {
    const settings = new Map<string, unknown>();
    if (persistedModeModel) settings.set(`modeModelId_${mode}`, persistedModeModel);
    return {
      mode: { get: () => mode },
      thread: {
        getSetting: vi.fn(async ({ key }: { key: string }) => settings.get(key) ?? null),
      },
      model: { switch: vi.fn(async () => {}) },
      om: {
        observer: { modelId: vi.fn(() => 'initial/model'), switchModel: vi.fn(async () => {}) },
        reflector: { modelId: vi.fn(() => 'initial/model'), switchModel: vi.fn(async () => {}) },
      },
      state: { get: vi.fn(() => ({})), set: vi.fn(async () => {}) },
    };
  }

  function makeStartDeps({
    defaultModelId = 'anthropic/claude-opus-5' as string | null,
    session = { orgId: 'org-1', userId: 'user-1', projectRepositoryId: 'pr-1' } as Record<string, string> | null,
    memoryRecord = null as Record<string, unknown> | null,
  } = {}) {
    return {
      projects: { getById: vi.fn(async () => ({ id: 'fp-1', defaultModelId })) } as any,
      sourceControl: {
        sessions: { getBySessionId: vi.fn(async () => session) },
        projectRepositories: { get: vi.fn(async () => ({ id: 'pr-1', connectionId: 'conn-gh' })) },
        connections: { get: vi.fn(async () => ({ id: 'conn-gh', factoryProjectId: 'fp-1' })) },
      } as any,
      memorySettings: { get: vi.fn(async () => memoryRecord) } as any,
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

    expect(session.model.switch).toHaveBeenCalledWith({ modelId: 'anthropic/claude-opus-5' });
    // Resolved from the session row, not from anything held in memory, so it
    // works on a thread created before this process started.
    expect(deps.sourceControl.sessions.getBySessionId).toHaveBeenCalledWith('us-1');
    expect(deps.projects.getById).toHaveBeenCalledWith({ id: 'fp-1' });
  });

  it('applies the owner observational-memory settings, matching the web kickoff', async () => {
    const deps = makeStartDeps({ memoryRecord: { observerModelId: 'openai/gpt-5.4-mini', observationThreshold: 111 } });
    const session = makeSession();

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(deps.memorySettings.get).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'factory-project:fp-1' });
    expect(session.om.observer.switchModel).toHaveBeenCalledWith({ modelId: 'openai/gpt-5.4-mini' });
    expect(session.state.set).toHaveBeenCalledWith(expect.objectContaining({ observationThreshold: 111 }));
  });

  // The durable record of a deliberate choice: either an earlier start or the
  // user's own switch. Re-applying the factory default over it would undo the
  // user's selection every time the process restarts.
  it('leaves the model alone when its mode already has a model persisted on the thread', async () => {
    const deps = makeStartDeps();
    const session = makeSession({ persistedModeModel: 'anthropic/claude-fable-5' });

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.model.switch).not.toHaveBeenCalled();
    // The factory stamp still lands: org-first credential resolution keys off
    // controller state even when the model choice is already persisted.
    expect(session.state.set).toHaveBeenCalledWith({ factoryProjectId: 'fp-1' });
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
  });

  it('configures nothing when the session row is gone', async () => {
    const deps = makeStartDeps({ session: null });
    const session = makeSession();

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.model.switch).not.toHaveBeenCalled();
  });

  it('leaves the session on its default when the factory has no default model', async () => {
    const deps = makeStartDeps({ defaultModelId: null });
    const session = makeSession();

    await createChannelSessionStartHook(deps as any)(startArgs(session) as any);

    expect(session.model.switch).not.toHaveBeenCalled();
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

  function makeAsideDeps({ link = { orgId: 'org-1', userId: 'user-1' } as { orgId?: string; userId: string } | null } = {}) {
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
        projects: makeProjects([{ id: 'fp-1', slackWorkItemsEnabled: true }]) as any,
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
    await createHandlers(deps as any).onSubscribedMessage!(thread, makeAside('ship it'), defaultHandler, handlerCtx());
    expect(defaultHandler).toHaveBeenCalledTimes(1);
    expect(deps.feed.createComment).toHaveBeenCalledTimes(1);
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
