import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Mastra } from '@mastra/core';
import { AgentControllerChannels } from '@mastra/core/channels';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createSlackAdapter } from '@mastra/slack';
import type { Chat } from 'chat';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { SlackIntegration } from './integration.js';
import type { SlackToolSettings } from './tool-settings.js';

const TEAM = 'T1';

/**
 * A small Slack workspace served over real HTTP, so the Slack adapter, the
 * Chat SDK and the tools all run unmodified and the test sees what actually
 * went over the wire. The app is in #factory (C1, where the session lives)
 * and #eng (C2), but not in #finance (C3).
 */
const workspace = {
  channels: [
    { id: 'C1', name: 'factory', is_member: true },
    { id: 'C2', name: 'eng', is_member: true },
    { id: 'C3', name: 'finance', is_private: true, is_member: false },
    { id: 'C4', name: 'eng-oncall', is_member: false },
  ],
  users: [
    { id: 'UALEX', name: 'alex', profile: { real_name: 'Alex Rivera', display_name: 'alex' } },
    { id: 'UALEXBOT', name: 'alexbot', is_bot: true, profile: { real_name: 'Alex Bot' } },
    { id: 'UALEXOLD', name: 'alex.old', deleted: true, profile: { real_name: 'Alex Old' } },
    { id: 'USAM', name: 'sam', profile: { real_name: 'Sam Lee', display_name: 'sam' } },
    { id: 'UBOT', name: 'mastra-factory', is_bot: true, profile: { real_name: 'Mastra Factory' } },
  ],
  history: {
    C1: [{ ts: '1700000300.000300', user: 'USAM', text: 'Can someone look at the deploy?' }],
    C2: [
      { ts: '1700000200.000200', user: 'UALEX', text: 'Deploy is green again' },
      { ts: '1700000100.000100', user: 'USAM', text: 'The staging deploy is failing on migrations' },
      { ts: '1700000050.000050', user: 'UALEX', text: 'Older: the STAGING deploy needs a rerun' },
    ],
  } as Record<string, Array<Record<string, string>>>,
};

let calls: Array<{ method: string; args: Record<string, string> }> = [];
let server: ReturnType<typeof createServer>;
let apiUrl = '';

/** Slack paginates with opaque cursors; one item per page shows the tools follow them. */
function page<T>(items: T[], cursor: string | undefined) {
  const index = Number(cursor || 0);
  const next = index + 1 < items.length ? String(index + 1) : '';
  return { items: items.slice(index, index + 1), response_metadata: { next_cursor: next } };
}

function answer(method: string, args: Record<string, string>): Record<string, unknown> {
  switch (method) {
    case 'auth.test':
      return { team_id: TEAM, user_id: 'UBOT', bot_id: 'BBOT', url: 'https://mastra.slack.com/' };
    case 'conversations.history': {
      const channel = workspace.channels.find(c => c.id === args.channel);
      if (!channel?.is_member) return { ok: false, error: 'not_in_channel' };
      // Newest first, at most 2 per page (Slack may return fewer than asked), so reads have to follow cursors.
      const all = workspace.history[args.channel!] ?? [];
      const start = Number(args.cursor || 0);
      const end = start + Math.min(Number(args.limit || all.length), 2);
      return {
        messages: all.slice(start, end),
        has_more: end < all.length,
        response_metadata: { next_cursor: end < all.length ? String(end) : '' },
      };
    }
    case 'chat.postMessage':
      return { channel: args.channel, ts: '1800000000.000001', message: { text: args.text } };
    case 'conversations.open':
      return { channel: { id: `D-${args.users}` } };
    case 'conversations.list': {
      const { items, response_metadata } = page(workspace.channels, args.cursor);
      return { channels: items, response_metadata };
    }
    case 'users.info': {
      const user = workspace.users.find(u => u.id === args.user);
      return user ? { user } : { ok: false, error: 'user_not_found' };
    }
    case 'users.list': {
      const { items, response_metadata } = page(workspace.users, args.cursor);
      return { members: items, response_metadata };
    }
    default:
      return { ok: false, error: 'unknown_method' };
  }
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const method = req.url!.replace(/^\/api\//, '').split('?')[0]!;
      const args = Object.fromEntries(new URLSearchParams(body));
      calls.push({ method, args });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, ...answer(method, args) }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/`;
});

afterAll(() => server.close());

beforeEach(() => {
  calls = [];
});

type Tool = { execute: (input: Record<string, unknown>, options: Record<string, unknown>) => Promise<any> };

/**
 * A session with deployment `settings` in a Factory with `saved` settings, linked to the Slack thread
 * C1/171.1 and woken without a Slack message (as web prompts, GitHub events
 * and schedules are), so the tools find their thread through the session's
 * stored channel coordinates.
 */
async function slackSession(settings?: Partial<SlackToolSettings>, saved?: Partial<SlackToolSettings>) {
  const orgId = 'org-1';
  const storage = new InMemoryStore();
  const mastra = new Mastra({ storage, logger: false });
  const memory = await storage.getStore('memory');
  await memory!.saveThread({
    thread: {
      id: 'thread-1',
      resourceId: 'resource-1',
      title: 'session',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { channel_platform: 'slack', channel_externalThreadId: 'slack:C1:171.1' },
    },
  });
  const adapter = createSlackAdapter({ botToken: 'xoxb-test', signingSecret: 'secret', apiUrl });
  const channels = new AgentControllerChannels({ adapters: { slack: { adapter } } });
  channels.__setController({ id: 'mastra-code', getMastra: () => mastra } as any);
  await channels.initialize(mastra);

  const seed = await createFactoryStorageForTests();
  const factory = await seed.projects.create({ orgId, userId: 'owner', input: { name: 'Mastra' } });
  if (saved) await seed.projects.update({ orgId, id: factory.id, input: { slackToolSettings: saved } });
  const sourceControl = seed.sourceControl.forIntegration('github');
  const installation = await sourceControl.installations.upsert({ orgId, connectedByUserId: 'owner', externalId: '1' });
  const repository = await sourceControl.repositories.upsert({
    orgId,
    input: { installationId: installation.id, externalId: '2', slug: 'mastra-ai/mastra', defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId,
    factoryProjectId: factory.id,
    installationId: installation.id,
    createdByUserId: 'owner',
  });
  const projectRepository = await sourceControl.projectRepositories.link({
    orgId,
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'owner',
    sandboxProvider: 'local',
    sandboxWorkdir: '/sandbox/mastra',
  });
  await sourceControl.sessions.create({
    sessionId: 'session-1',
    projectRepositoryId: projectRepository.id,
    factoryProjectId: factory.id,
    orgId,
    userId: 'owner',
    branch: 'slack/171.1',
    baseBranch: 'main',
    visibility: 'org',
  });

  const slack = new SlackIntegration({ signingSecret: 'secret', tools: settings });
  slack.channels({
    storage: {
      channelIdentity: seed.channelIdentity,
      projects: seed.projects,
      sourceControls: [sourceControl],
      memorySettings: {},
    },
    runtime: { workItems: { findRunBindingByThread: async () => null } },
  } as any);
  slack.initialize({ channels: () => channels });

  const requestContext = new RequestContext();
  requestContext.set('controller', { threadId: 'thread-1', sessionId: 'session-1', resourceId: 'resource-1' });
  const tools = await slack.agentTools({ requestContext });
  calls = [];
  const tool = (name: string) => tools[name] as unknown as Tool | undefined;
  const run = (name: string, input: Record<string, unknown>) => tool(name)!.execute(input, {});
  return { run, tool, accountLinks: seed.channelIdentity, chat: channels.sdk! };
}

/**
 * Runs `fn` while the Chat SDK handles a Slack event in the session's thread,
 * the way tools run when a Slack message starts or continues a session.
 */
function duringSlackEvent<T>(chat: Chat, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    chat.onReaction(async () => fn().then(resolve, reject));
    void chat.processReaction({
      adapter: chat.getAdapter('slack'),
      threadId: 'slack:C1:171.1',
      messageId: '171.1',
      emoji: { name: 'eyes' },
      rawEmoji: 'eyes',
      added: true,
      user: { userId: 'USAM', userName: 'sam', fullName: 'Sam Lee', isBot: false, isMe: false },
      raw: {},
    } as never);
  });
}

const sent = (method: string) => calls.filter(c => c.method === method).map(c => c.args);

/** What a deployment grants to let sessions work across Slack. */
const wide = { channels: 'all', directMessages: 'anyone' } as const;

describe('Slack tools on a Factory session, by default', () => {
  it('reads and posts in its own channel', async () => {
    const { run } = await slackSession();

    const read = await run('fetchChannelMessages', { channelId: 'slack:C1', limit: 5, direction: 'backward' });
    expect(read.messages.map((m: { text: string }) => m.text)).toEqual(['Can someone look at the deploy?']);

    await run('postMessage', { threadId: 'slack:C1:171.1', message: 'Looking now.' });
    await run('postChannelMessage', { channelId: 'slack:C1', message: 'Deploy is fixed.' });
    expect(sent('chat.postMessage').map(m => m.channel)).toEqual(['C1', 'C1']);
  });

  it("refuses any other channel, even one the app is in, without asking Slack", async () => {
    const { run } = await slackSession();

    await expect(run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' })).rejects.toThrow(
      'outside the channels this session can use: slack:C1',
    );
    await expect(run('fetchThread', { threadId: 'slack:C2:1700000200.000200' })).rejects.toThrow('outside the channels');
    await expect(run('postChannelMessage', { channelId: 'slack:C2', message: 'Hi' })).rejects.toThrow('outside the channels');
    const search = await run('searchMessages', { query: 'deploy', channelIds: ['slack:C2'] });
    expect(search.matches).toEqual([]);
    expect(search.errors).toEqual([{ channelId: 'slack:C2', error: expect.stringContaining('outside the channels') }]);

    expect(calls.map(c => c.method)).not.toContain('conversations.history');
    expect(sent('chat.postMessage')).toEqual([]);
  });

  it('stays in its own channel while handling a Slack message too', async () => {
    const { run, chat } = await slackSession();

    const read = await duringSlackEvent(chat, () =>
      run('fetchChannelMessages', { channelId: 'slack:C1', limit: 5, direction: 'backward' }),
    );
    expect(read.messages).toHaveLength(1);
    await expect(
      duringSlackEvent(chat, () => run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' })),
    ).rejects.toThrow('outside the channels this session can use');
  });

  it("can't send DMs, but can still look people up to mention them", async () => {
    const { tool } = await slackSession();

    expect(tool('sendDirectMessage')).toBeUndefined();
    expect(tool('findUser')).toBeDefined();
  });
});

describe('Slack tools on a Factory session, with access granted', () => {
  it('reaches the channels a deployment grants, and only those', async () => {
    const { run, chat } = await slackSession({ channels: 'selected', channelIds: ['C2'] });

    const read = await duringSlackEvent(chat, () =>
      run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' }),
    );
    expect(read.messages.map((m: { text: string }) => m.text)).toContain('Deploy is green again');
    await run('postChannelMessage', { channelId: 'slack:C2', message: 'On it.' });
    expect(sent('chat.postMessage')).toEqual([expect.objectContaining({ channel: 'C2', text: 'On it.' })]);

    await expect(run('fetchChannelMessages', { channelId: 'slack:C4', limit: 5, direction: 'backward' })).rejects.toThrow(
      'outside the channels this session can use: slack:C1, slack:C2',
    );
  });

  it('reads other channels but posts only in its own channel when access is read only', async () => {
    const { run } = await slackSession({ channels: 'all', channelAccess: 'read' });

    const read = await run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' });
    expect(read.messages.map((m: { text: string }) => m.text)).toContain('Deploy is green again');

    await expect(run('postChannelMessage', { channelId: 'slack:C2', message: 'Hi' })).rejects.toThrow(
      '"slack:C2" is read only for this session: it can only post in its own channel, slack:C1.',
    );
    await expect(run('postMessage', { threadId: 'slack:C2:1700000200.000200', message: 'Hi' })).rejects.toThrow(
      'is read only for this session',
    );
    await run('postMessage', { threadId: 'slack:C1:171.1', message: 'Read #eng, all green.' });
    await run('postChannelMessage', { channelId: 'slack:C1', message: 'Summary of #eng: all green.' });
    expect(sent('chat.postMessage').map(m => [m.channel, m.text])).toEqual([
      ['C1', 'Read #eng, all green.'],
      ['C1', 'Summary of #eng: all green.'],
    ]);
  });

  it('treats a setting passed as undefined as left at its default', async () => {
    const { tool } = await slackSession({ channels: undefined, directMessages: 'anyone' });

    expect(tool('sendDirectMessage')).toBeDefined();
    expect(String((tool('fetchChannelMessages') as { description?: unknown }).description)).toContain(
      'Channels this session can use: slack:C1.',
    );
  });

  it('rejects a channel grant that is not a Slack channel id when the integration is set up', () => {
    expect(() => new SlackIntegration({ signingSecret: 'secret', tools: { channels: 'selected', channelIds: ['#eng'] } })).toThrow();
  });
});

describe('Slack tools on a Factory session, with every channel and DMs granted', () => {
  it('reads the channel the session was started in', async () => {
    const { run } = await slackSession(wide);

    const result = await run('fetchChannelMessages', { channelId: 'slack:C1', limit: 5, direction: 'backward' });

    expect(result.messages.map((m: { text: string }) => m.text)).toEqual(['Can someone look at the deploy?']);
  });

  it('reads and posts in any other channel the app is in, without asking anyone to approve the post', async () => {
    const { run, tool } = await slackSession(wide);

    const read = await run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' });
    expect(read.messages.map((m: { text: string }) => m.text)).toContain('Deploy is green again');

    // A woken run has nobody around to approve, so posting must not wait for one.
    expect((tool('postChannelMessage') as { needsApproval?: unknown }).needsApproval).toBe(false);
    await run('postChannelMessage', { channelId: 'slack:C2', message: 'Thanks, closing this out.' });
    expect(sent('chat.postMessage')).toEqual([
      expect.objectContaining({ channel: 'C2', text: 'Thanks, closing this out.' }),
    ]);
  });

  it("won't read or post in someone else's DM with the app", async () => {
    const { run } = await slackSession(wide);

    await expect(run('fetchChannelMessages', { channelId: 'slack:D-USAM', limit: 5 })).rejects.toThrow(
      "someone else's direct message",
    );
    await expect(run('postChannelMessage', { channelId: 'slack:D-USAM', message: 'hi' })).rejects.toThrow(
      "someone else's direct message",
    );
    await expect(run('fetchChannelMessages', { channelId: 'D-USAM', limit: 5 })).rejects.toThrow(
      "someone else's direct message",
    );
    // Bare ids and thread ids must be checked as the channel actually read.
    const search = await run('searchMessages', {
      query: 'deploy',
      channelIds: ['slack:D-USAM', 'D-USAM', 'slack:D-USAM:1700000000.000100'],
    });
    expect(search.errors).toHaveLength(3);
    expect(sent('conversations.history')).toEqual([]);
    expect(sent('chat.postMessage')).toEqual([]);
  });

  it('reaches other channels while handling a Slack message, not just that conversation', async () => {
    const { run, chat } = await slackSession(wide);

    const read = await duringSlackEvent(chat, () =>
      run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' }),
    );
    await duringSlackEvent(chat, () => run('postChannelMessage', { channelId: 'slack:C2', message: 'On it.' }));

    expect(read.messages.map((m: { text: string }) => m.text)).toContain('Deploy is green again');
    expect(sent('chat.postMessage')).toEqual([expect.objectContaining({ channel: 'C2', text: 'On it.' })]);
  });

  it("won't turn a thread reply into a new top-level post", async () => {
    const { run } = await slackSession(wide);

    await expect(
      run('postChannelMessage', { channelId: 'slack:C2:1700000000.000100', message: 'Replying here' }),
    ).rejects.toThrow('Use postMessage to reply in a thread');
    expect(sent('chat.postMessage')).toEqual([]);
  });

  it("can't read a channel the app isn't in: Slack refuses it", async () => {
    const { run } = await slackSession(wide);

    await expect(
      run('fetchChannelMessages', { channelId: 'slack:C3', limit: 5, direction: 'backward' }),
    ).rejects.toThrow(/not_in_channel/);
  });

  it('finds channels and people by name across every page Slack returns', async () => {
    const { run } = await slackSession(wide);

    const channels = await run('findChannel', { name: '#eng' });
    expect(channels.channels).toEqual([
      { id: 'slack:C2', name: 'eng', isPrivate: false, isMember: true },
      { id: 'slack:C4', name: 'eng-oncall', isPrivate: false, isMember: false },
    ]);

    // Bots and deactivated accounts aren't people to message.
    const people = await run('findUser', { name: '@Alex' });
    expect(people.users).toEqual([{ id: 'UALEX', name: 'Alex Rivera', displayName: 'alex' }]);
  });

  it('says when a lookup stopped before reaching everyone, instead of implying nobody matched', async () => {
    const { run } = await slackSession(wide);
    // The fake returns one person per page, so a dozen extras push Sam past the page cap.
    const extras = Array.from({ length: 12 }, (_, i) => ({ id: `UEXTRA${i}`, name: `extra${i}`, profile: {} }));
    const users = workspace.users;
    workspace.users = [...extras, ...users];
    try {
      expect(await run('findUser', { name: 'Sam' })).toEqual({ users: [], incomplete: true });
    } finally {
      workspace.users = users;
    }

    expect(await run('findUser', { name: 'Sam' })).toEqual({ users: [{ id: 'USAM', name: 'Sam Lee', displayName: 'sam' }] });
  });

  it('searches messages for every word, ignoring case, in the channels asked for', async () => {
    const { run } = await slackSession(wide);

    const result = await run('searchMessages', { query: 'staging DEPLOY', channelIds: ['slack:C2', 'slack:C1'] });

    expect(result.matches).toEqual([
      {
        channelId: 'slack:C2',
        ts: '1700000100.000100',
        userId: 'USAM',
        text: 'The staging deploy is failing on migrations',
      },
      { channelId: 'slack:C2', ts: '1700000050.000050', userId: 'UALEX', text: 'Older: the STAGING deploy needs a rerun' },
    ]);
    expect(result.scanned).toBe(4);
  });

  it("searches the session's own channel by default and reads only the newest `scan` messages", async () => {
    const { run } = await slackSession(wide);

    expect((await run('searchMessages', { query: 'deploy' })).matches.map((m: { channelId: string }) => m.channelId)).toEqual(
      ['slack:C1'],
    );

    calls = [];
    const shallow = await run('searchMessages', { query: 'staging', channelIds: ['slack:C2'], scan: 2 });
    expect(shallow.matches.map((m: { ts: string }) => m.ts)).toEqual(['1700000100.000100']);
    expect(shallow.scanned).toBe(2);
    expect(sent('conversations.history')).toEqual([expect.objectContaining({ channel: 'C2', limit: '2' })]);
  });

  it("reports a channel it can't search without dropping matches from the others", async () => {
    const { run } = await slackSession(wide);

    const result = await run('searchMessages', { query: 'deploy', channelIds: ['slack:C3', 'slack:C1'] });

    expect(result.matches.map((m: { channelId: string }) => m.channelId)).toEqual(['slack:C1']);
    expect(result.errors).toEqual([{ channelId: 'slack:C3', error: 'not_in_channel' }]);
  });

  it('DMs anyone in the workspace', async () => {
    const { run } = await slackSession(wide);

    await run('sendDirectMessage', { userId: 'USAM', text: 'Your deploy is green.' });

    expect(sent('conversations.open')).toEqual([expect.objectContaining({ users: 'USAM' })]);
    expect(sent('chat.postMessage')).toEqual([
      expect.objectContaining({ channel: 'D-USAM', markdown_text: 'Your deploy is green.' }),
    ]);
  });
});

describe('Slack tools on a Factory session, with settings saved on the Factory', () => {
  it("narrows what the deployment grants: limited to its own channel, it refuses another before asking Slack", async () => {
    const { run, tool } = await slackSession(wide, { channels: 'session', directMessages: 'none' });

    await expect(
      run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' }),
    ).rejects.toThrow('"slack:C2" is outside the channels this session can use: slack:C1.');
    await expect(run('postChannelMessage', { channelId: 'slack:C2', message: 'hi' })).rejects.toThrow(
      'outside the channels',
    );
    expect(tool('sendDirectMessage')).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it('widens the default: reads and posts in a channel the Factory picked', async () => {
    const { run } = await slackSession(undefined, { channels: 'selected', channelIds: ['C2'] });

    const read = await run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' });
    expect(read.messages.map((m: { text: string }) => m.text)).toContain('Deploy is green again');
    await run('postChannelMessage', { channelId: 'slack:C2', message: 'Thanks, closing this out.' });
    expect(sent('chat.postMessage')).toEqual([expect.objectContaining({ channel: 'C2' })]);
  });

  it("keeps the deployment's value for anything the Factory hasn't saved", async () => {
    const { run } = await slackSession(wide, { channelAccess: 'read' });

    const read = await run('fetchChannelMessages', { channelId: 'slack:C2', limit: 5, direction: 'backward' });
    expect(read.messages).toHaveLength(2);
    await expect(run('postChannelMessage', { channelId: 'slack:C2', message: 'hi' })).rejects.toThrow(
      'is read only for this session',
    );
  });

  it("with DMs limited to linked people, DMs only people linked to a Factory account in the session's org", async () => {
    const { run, accountLinks } = await slackSession(undefined, { directMessages: 'linked' });
    await accountLinks.saveAccountLink({
      platform: 'slack',
      externalTeamId: TEAM,
      externalUserId: 'UALEX',
      orgId: 'org-1',
      userId: 'user-alex',
    });
    await accountLinks.saveAccountLink({
      platform: 'slack',
      externalTeamId: TEAM,
      externalUserId: 'USAM',
      orgId: 'org-2',
      userId: 'user-sam',
    });

    await run('sendDirectMessage', { userId: 'UALEX', text: 'linked' });
    expect(sent('conversations.open')).toEqual([expect.objectContaining({ users: 'UALEX' })]);

    calls = [];
    await expect(run('sendDirectMessage', { userId: 'USAM', text: 'other org' })).rejects.toThrow(
      'Cannot message USAM: only people linked to this Factory can be messaged.',
    );
    await expect(run('sendDirectMessage', { userId: 'UOUTSIDE', text: 'unlinked' })).rejects.toThrow(
      'Cannot message UOUTSIDE',
    );
    expect(sent('conversations.open')).toEqual([]);
    expect(sent('chat.postMessage')).toEqual([]);
  });
});
