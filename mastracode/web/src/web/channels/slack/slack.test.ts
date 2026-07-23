import { createChannelLinkStateSigner } from '@mastra/factory';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createChannelResourceIdResolver,
  createHandlers,
  promptIfUnlinked,
  registerFactoryCommand,
  resolveFactoryForLink,
} from './slack.js';

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

describe('promptIfUnlinked', () => {
  it('returns false (dispatch) when no account-link store is configured', async () => {
    const thread = makeThread();
    const result = await promptIfUnlinked({ thread, message: makeMessage('T-1') });
    expect(result).toBe(false);
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('returns false (dispatch) for a linked sender, no card posted', async () => {
    const thread = makeThread();
    const accountLinks = makeStore({ orgId: 'org-1', userId: 'user-1' });
    const result = await promptIfUnlinked({ thread, message: makeMessage('T-1'), accountLinks });
    expect(result).toBe(false);
    expect(accountLinks.getAccountLink).toHaveBeenCalledWith({
      platform: 'slack',
      externalTeamId: 'T-1',
      externalUserId: 'U-sender',
    });
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('returns true (skip run) and posts an ephemeral signed Connect card for an unlinked sender', async () => {
    process.env.MASTRACODE_CHANNELS_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeThread();
    const accountLinks = makeStore(null);
    const channelLinkStateSigner = createChannelLinkStateSigner('secret');

    const result = await promptIfUnlinked({
      thread,
      message: makeMessage('T-1'),
      accountLinks,
      channelLinkStateSigner,
    });

    expect(result).toBe(true);
    expect(thread.postEphemeral).toHaveBeenCalledTimes(1);

    // Ephemeral (visible only to the sender), with fallbackToDM.
    const [user, , options] = thread.postEphemeral.mock.calls[0];
    expect(user).toEqual(thread.postEphemeral.mock.calls[0][0]);
    expect(options).toEqual({ fallbackToDM: true });

    // The deep-link state round-trips back to the exact Slack identity.
    const card = thread.postEphemeral.mock.calls[0][1];
    const actions = card.children.find((c: any) => c.type === 'actions');
    const linkButton = actions.children.find((c: any) => c.type === 'link-button');
    const url: string = linkButton.url;
    expect(url.startsWith('https://mc.example.com/connect/slack?state=')).toBe(true);
    const state = decodeURIComponent(new URL(url).searchParams.get('state')!);
    expect(channelLinkStateSigner.verify(state)).toEqual({
      platform: 'slack',
      externalTeamId: 'T-1',
      externalUserId: 'U-sender',
      channelId: 'C-1',
    });
  });

  it('treats a missing team id as unlinked and blocks the run (no card without a team id)', async () => {
    process.env.MASTRACODE_CHANNELS_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeThread();
    const accountLinks = makeStore({ orgId: 'org-1', userId: 'user-1' });
    const channelLinkStateSigner = createChannelLinkStateSigner('secret');

    const result = await promptIfUnlinked({
      thread,
      message: makeMessage(undefined),
      accountLinks,
      channelLinkStateSigner,
    });

    // No team id → never even looks up the (workspace-scoped) link, blocks run.
    expect(result).toBe(true);
    expect(accountLinks.getAccountLink).not.toHaveBeenCalled();
    // Without a team id there's nothing safe to sign into the deep link.
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('blocks the run without a card when no public URL is configured', async () => {
    delete process.env.MASTRACODE_CHANNELS_PUBLIC_URL;
    delete process.env.MASTRACODE_PUBLIC_URL;
    const thread = makeThread();
    const accountLinks = makeStore(null);
    const channelLinkStateSigner = createChannelLinkStateSigner('secret');

    const result = await promptIfUnlinked({
      thread,
      message: makeMessage('T-1'),
      accountLinks,
      channelLinkStateSigner,
    });

    expect(result).toBe(true);
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

  it('dispatches a linked sender whose default factory resolves', async () => {
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fp-1' });
    const projects = makeProjects([{ id: 'fp-1' }]);
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ getMastra: () => undefined, accountLinks, projects });

    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler);

    expect(defaultHandler).toHaveBeenCalledTimes(1);
    expect(thread.postEphemeral).not.toHaveBeenCalled();
  });

  it('blocks dispatch for a linked sender with several factories and no default', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'user-1' });
    const projects = makeProjects([{ id: 'fp-1' }, { id: 'fp-2' }]);
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ getMastra: () => undefined, accountLinks, projects });

    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler);

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
    const handlers = createHandlers({ getMastra: () => undefined, accountLinks, projects });

    await handlers.onMention!(thread, makeMessage('T-1'), defaultHandler);

    expect(defaultHandler).not.toHaveBeenCalled();
    expect(thread.postEphemeral).toHaveBeenCalledTimes(1);
  });

  it('keeps pre-routing behavior when only account linking is configured (no projects)', async () => {
    const thread = makeSubscribedThread();
    const accountLinks = fullStore({ orgId: 'org-1', userId: 'user-1' });
    const defaultHandler = vi.fn();
    const handlers = createHandlers({ getMastra: () => undefined, accountLinks });

    await handlers.onSubscribedMessage!(thread, makeMessage('T-1'), defaultHandler);

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
    return { getMastra: () => undefined, accountLinks, projects, sourceControl };
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
    const getMastra = (() => ({ getStorage: () => ({ getStore: () => Promise.resolve(store) }) })) as any;
    return { accountLinks, projects, getMastra };
  }

  function makeCardThread() {
    const thread = makeThread();
    thread.id = 'slack:C-1:1700.42';
    thread.isSubscribed = vi.fn().mockResolvedValue(false);
    thread.post = vi.fn();
    return thread;
  }

  it('a repo-backed thread deep-links to the user-session workspace route', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const deps = makeCardDeps({ internalThread: { id: 'uuid-thread-1', resourceId: 'us-42' } });
    const handlers = createHandlers(deps as any);
    const thread = makeCardThread();

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn());

    expect(thread.post).toHaveBeenCalledTimes(1);
    const card = thread.post.mock.calls[0][0];
    const actions = card.children.find((c: any) => c.type === 'actions');
    expect(actions.children[0].url).toBe(
      'https://mc.example.com/factories/fp-1/workspaces/us-42/threads/uuid-thread-1?resourceId=us-42',
    );
  });

  it('a chat-only thread keeps the channel workspace segment', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const deps = makeCardDeps();
    const handlers = createHandlers(deps as any);
    const thread = makeCardThread();

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn());

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

    await handlers.onDirectMessage!(thread, makeMessage('T-1'), vi.fn());

    const card = thread.post.mock.calls[0][0];
    const actions = card.children.find((c: any) => c.type === 'actions');
    expect(actions.children[0].url).toBe(
      `https://mc.example.com/threads/uuid-thread-1?resourceId=${encodeURIComponent('channel:slack:C-1:1700.42')}`,
    );
  });
});

describe('/factory slash command', () => {
  function makeCommandHarness({
    link = { orgId: 'org-1', userId: 'user-1', defaultFactoryProjectId: 'fp-2' },
    factories = [
      { id: 'fp-1', name: 'Mastra OSS' },
      { id: 'fp-2', name: 'Kepler' },
    ],
  }: {
    link?: { orgId?: string; userId: string; defaultFactoryProjectId?: string } | null;
    factories?: Array<{ id: string; name: string }>;
  } = {}) {
    const accountLinks = {
      getAccountLink: vi.fn().mockResolvedValue(link),
      setDefaultFactory: vi.fn().mockResolvedValue(true),
    } as any;
    const projects = makeProjects(factories);
    let handler: ((event: any) => Promise<void>) | undefined;
    const chat = {
      onSlashCommand: vi.fn((command: string, h: any) => {
        expect(command).toBe('/factory');
        handler = h;
      }),
    };
    registerFactoryCommand(chat as any, { getMastra: () => undefined, accountLinks, projects });
    const postEphemeral = vi.fn().mockResolvedValue({ id: 'eph' });
    const invoke = (text: string, teamId: string | undefined = 'T-1') =>
      handler!({
        adapter: { name: 'slack' },
        channel: { id: 'C-1', postEphemeral },
        text,
        user: { userId: 'U-sender' },
        raw: teamId ? { team_id: teamId } : {},
      });
    return { accountLinks, invoke, postEphemeral };
  }

  it('no args lists factories with the current default marked', async () => {
    const { invoke, postEphemeral, accountLinks } = makeCommandHarness();

    await invoke('');

    const reply = postEphemeral.mock.calls[0][1] as string;
    expect(reply).toContain('• Mastra OSS');
    expect(reply).toContain('• Kepler (default)');
    expect(accountLinks.setDefaultFactory).not.toHaveBeenCalled();
  });

  it('a unique name match sets the default on the sender link', async () => {
    const { invoke, postEphemeral, accountLinks } = makeCommandHarness();

    await invoke('mastra oss');

    expect(accountLinks.setDefaultFactory).toHaveBeenCalledWith({
      platform: 'slack',
      externalTeamId: 'T-1',
      externalUserId: 'U-sender',
      userId: 'user-1',
      factoryProjectId: 'fp-1',
    });
    expect(postEphemeral.mock.calls[0][1]).toContain('Mastra OSS');
  });

  it('an ambiguous name lists the options without setting anything', async () => {
    const { invoke, postEphemeral, accountLinks } = makeCommandHarness({
      factories: [
        { id: 'fp-1', name: 'Mastra OSS' },
        { id: 'fp-2', name: 'Mastra Cloud' },
      ],
    });

    await invoke('mastra');

    expect(accountLinks.setDefaultFactory).not.toHaveBeenCalled();
    const reply = postEphemeral.mock.calls[0][1] as string;
    expect(reply).toContain('ambiguous');
    expect(reply).toContain('Mastra OSS, Mastra Cloud');
  });

  it('an unknown name lists the options', async () => {
    const { invoke, postEphemeral, accountLinks } = makeCommandHarness();

    await invoke('nope');

    expect(accountLinks.setDefaultFactory).not.toHaveBeenCalled();
    expect(postEphemeral.mock.calls[0][1]).toContain('No factory matches "nope"');
  });

  it('an unlinked sender gets the Connect card', async () => {
    process.env.MASTRACODE_PUBLIC_URL = 'https://mc.example.com';
    const accountLinks = {
      getAccountLink: vi.fn().mockResolvedValue(null),
      setDefaultFactory: vi.fn(),
    } as any;
    const projects = makeProjects([{ id: 'fp-1', name: 'Mastra OSS' }]);
    let handler: ((event: any) => Promise<void>) | undefined;
    const chat = { onSlashCommand: vi.fn((_c: string, h: any) => (handler = h)) };
    registerFactoryCommand(chat as any, {
      getMastra: () => undefined,
      accountLinks,
      projects,
      channelLinkStateSigner: createChannelLinkStateSigner('secret'),
    });
    const postEphemeral = vi.fn().mockResolvedValue({ id: 'eph' });

    await handler!({
      adapter: { name: 'slack' },
      channel: { id: 'C-1', postEphemeral },
      text: '',
      user: { userId: 'U-sender' },
      raw: { team_id: 'T-1' },
    });

    expect(accountLinks.setDefaultFactory).not.toHaveBeenCalled();
    const card = postEphemeral.mock.calls[0][1];
    expect(card.title).toBe('Connect your account');
  });

  it('is not registered without the link store or projects domain', async () => {
    const chat = { onSlashCommand: vi.fn() };

    registerFactoryCommand(chat as any, { getMastra: () => undefined });

    expect(chat.onSlashCommand).not.toHaveBeenCalled();
  });
});
