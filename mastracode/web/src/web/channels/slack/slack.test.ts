import { createChannelLinkStateSigner } from '@mastra/factory';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHandlers, promptIfUnlinked, resolveFactoryForLink } from './slack.js';

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
