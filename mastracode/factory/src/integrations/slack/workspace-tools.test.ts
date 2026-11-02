import { AgentControllerChannels } from '@mastra/core/channels';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { SlackIntegration } from './integration.js';
import {
  parseSlackTarget,
  SLACK_READ_TOOL_NAME,
  SLACK_SEARCH_TOOL_NAME,
  SLACK_SEND_TOOL_NAME,
} from './workspace-tools.js';

type Execute = { execute: (input: Record<string, unknown>, ctx: Record<string, unknown>) => Promise<any> };

const TEAM = 'T1';

/** A small Slack workspace behind `apiCall`, answering the methods the tools use. */
function fakeSlack() {
  const users: Record<string, Record<string, unknown>> = {
    UDUSTIN: { id: 'UDUSTIN', team_id: TEAM, profile: { display_name: 'dustin' } },
    UNIK: { id: 'UNIK', team_id: TEAM, profile: { display_name: 'nik' } },
    UOUTSIDE: { id: 'UOUTSIDE', team_id: 'T2', profile: { display_name: 'vendor' } },
    UBOT: { id: 'UBOT', team_id: TEAM, is_bot: true, name: 'otherbot' },
  };
  const channels: Record<string, Record<string, unknown>> = {
    C1: { id: 'C1', name: 'factory' },
    C2: { id: 'C2', name: 'eng' },
    GSECRET: { id: 'GSECRET', name: 'secret', is_private: true },
    GTEAM: { id: 'GTEAM', name: 'team', is_private: true },
    CSHARED: { id: 'CSHARED', name: 'vendor-connect', is_ext_shared: true },
    DOTHER: { id: 'DOTHER', is_im: true },
  };
  const members: Record<string, string[]> = { GSECRET: ['UNIK'], GTEAM: ['UDUSTIN', 'UNIK'] };
  const history: Record<string, Array<Record<string, unknown>>> = {
    // Newest first, as Slack returns it.
    C2: [
      { ts: '1700000300.000300', user: 'UNIK', text: 'Deploy is green again' },
      { ts: '1700000200.000200', user: 'UDUSTIN', text: 'The staging deploy is failing on migrations', reply_count: 2 },
      { ts: '1700000100.000100', user: 'UNIK', text: 'morning' },
    ],
    GSECRET: [{ ts: '1700000000.000001', user: 'UNIK', text: 'deploy secrets' }],
    GTEAM: [{ ts: '1700000000.000002', user: 'UNIK', text: 'team deploy notes' }],
  };
  const replies: Record<string, Array<Record<string, unknown>>> = {
    '1700000200.000200': [
      { ts: '1700000200.000200', user: 'UDUSTIN', text: 'The staging deploy is failing on migrations' },
      { ts: '1700000250.000250', user: 'UNIK', text: 'Looking', thread_ts: '1700000200.000200' },
    ],
  };
  const notFound = (error: string) => Object.assign(new Error(`An API error occurred: ${error}`), { data: { error } });

  const apiCall = vi.fn(async (method: string, args: Record<string, any> = {}) => {
    switch (method) {
      case 'auth.test':
        return { ok: true, team_id: TEAM, url: 'https://mastra.slack.com/' };
      case 'users.info': {
        const user = users[args.user];
        if (!user) throw notFound('user_not_found');
        return { ok: true, user };
      }
      case 'conversations.info': {
        const channel = channels[args.channel];
        if (!channel) throw notFound('channel_not_found');
        return { ok: true, channel };
      }
      case 'conversations.members':
        return { ok: true, members: members[args.channel] ?? [] };
      case 'conversations.history':
        return { ok: true, messages: (history[args.channel] ?? []).slice(0, args.limit), has_more: false };
      case 'conversations.replies':
        return { ok: true, messages: replies[args.ts] ?? [] };
      case 'conversations.open':
        return { ok: true, channel: { id: `D-${args.users}` } };
      default:
        throw new Error(`unexpected Slack call ${method}`);
    }
  });
  const postMessage = vi.fn(async (_threadId: string, _message: { markdown: string }) => ({
    raw: { ts: '1800000000.000001' },
  }));
  return { apiCall, postMessage };
}

/** A Slack-started run in thread C1/171.1, working for UDUSTIN. */
async function slackSession() {
  const storage = new InMemoryStore();
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
  const slackApi = fakeSlack();
  const adapter = {
    name: 'slack',
    startTyping: vi.fn(),
    webClient: { apiCall: slackApi.apiCall },
    postMessage: slackApi.postMessage,
  };
  const channels = new AgentControllerChannels({ adapters: { slack: { adapter, streaming: false } as any } });
  channels.__setController({ id: 'mastra-code', getMastra: () => ({ getStorage: () => storage }) } as any);
  (channels as any).chat = { thread: (id: string) => ({ id, adapter, post: vi.fn() }) };

  const slack = new SlackIntegration({ signingSecret: 'secret' });
  slack.initialize({ channels: () => channels });

  const requestContext = new RequestContext();
  requestContext.set('controller', { threadId: 'thread-1', sessionId: 'session-1', resourceId: 'resource-1' });
  requestContext.set('channel', { platform: 'slack', eventType: 'mention', userId: 'UDUSTIN', channelId: 'C1' });
  const tools = await slack.agentTools({ requestContext });
  const run = (name: string, input: Record<string, unknown>) => (tools[name] as unknown as Execute).execute(input, {});
  return { run, ...slackApi };
}

describe('parseSlackTarget', () => {
  it('reads permalinks, mentions and ids', () => {
    expect(
      parseSlackTarget('https://mastra.slack.com/archives/C2/p1700000250000250?thread_ts=1700000200.000200&cid=C2'),
    ).toEqual({
      kind: 'conversation',
      channel: 'C2',
      ts: '1700000250.000250',
      threadTs: '1700000200.000200',
    });
    expect(parseSlackTarget('<#C2|eng>')).toEqual({ kind: 'conversation', channel: 'C2' });
    expect(parseSlackTarget('<@UNIK>')).toEqual({ kind: 'user', user: 'UNIK' });
    expect(parseSlackTarget('UNIK123')).toEqual({ kind: 'user', user: 'UNIK123' });
    expect(() => parseSlackTarget('#general')).toThrow(/not looked up/);
  });
});

describe('Slack workspace tools', () => {
  it('searches a channel for messages with every word, with authors and permalinks', async () => {
    const { run } = await slackSession();
    const result = await run(SLACK_SEARCH_TOOL_NAME, { query: 'staging DEPLOY', channels: ['<#C2|eng>'] });
    expect(result.matches).toEqual([
      {
        channel: 'C2',
        ts: '1700000200.000200',
        author: 'dustin',
        userId: 'UDUSTIN',
        text: 'The staging deploy is failing on migrations',
        replyCount: 2,
        permalink: 'https://mastra.slack.com/archives/C2/p1700000200000200',
      },
    ]);
    expect(result.scanned).toEqual({ C2: 3 });
  });

  it('reads a whole thread from a reply permalink', async () => {
    const { run } = await slackSession();
    const result = await run(SLACK_READ_TOOL_NAME, {
      target: 'https://mastra.slack.com/archives/C2/p1700000250000250?thread_ts=1700000200.000200&cid=C2',
    });
    expect(result.channel).toEqual({ id: 'C2', name: '#eng' });
    expect(result.thread).toBe('1700000200.000200');
    expect(result.messages.map((m: any) => `${m.author}: ${m.text}`)).toEqual([
      'dustin: The staging deploy is failing on migrations',
      'nik: Looking',
    ]);
  });

  it('reads a channel oldest first', async () => {
    const { run } = await slackSession();
    const result = await run(SLACK_READ_TOOL_NAME, { target: 'C2' });
    expect(result.messages.map((m: any) => m.text)).toEqual([
      'morning',
      'The staging deploy is failing on migrations',
      'Deploy is green again',
    ]);
  });

  it('only reads private conversations the requester is in', async () => {
    const { run } = await slackSession();
    await expect(run(SLACK_READ_TOOL_NAME, { target: 'GSECRET' })).rejects.toThrow(/not in/);
    await expect(run(SLACK_SEARCH_TOOL_NAME, { query: 'deploy', channels: ['GSECRET'] })).rejects.toThrow(/not in/);
    await expect(run(SLACK_READ_TOOL_NAME, { target: 'DOTHER' })).rejects.toThrow(/someone else's direct message/);
    const team = await run(SLACK_READ_TOOL_NAME, { target: 'GTEAM' });
    expect(team.messages.map((m: any) => m.text)).toEqual(['team deploy notes']);
  });

  it('DMs a teammate', async () => {
    const { run, postMessage } = await slackSession();
    const result = await run(SLACK_SEND_TOOL_NAME, { to: '<@UNIK>', text: 'Is staging safe to deploy?' });
    expect(postMessage).toHaveBeenCalledWith('slack:D-UNIK:', { markdown: 'Is staging safe to deploy?' });
    expect(result).toMatchObject({ posted: true, channel: 'D-UNIK', ts: '1800000000.000001' });
  });

  it('cross-posts to a channel and replies in another thread', async () => {
    const { run, postMessage } = await slackSession();
    await run(SLACK_SEND_TOOL_NAME, { to: 'C2', text: 'Heads up' });
    expect(postMessage).toHaveBeenLastCalledWith('slack:C2:', { markdown: 'Heads up' });
    const result = await run(SLACK_SEND_TOOL_NAME, {
      to: 'https://mastra.slack.com/archives/C2/p1700000200000200',
      text: 'Fixed in the factory thread',
    });
    expect(postMessage).toHaveBeenLastCalledWith('slack:C2:1700000200.000200', {
      markdown: 'Fixed in the factory thread',
    });
    expect(result.permalink).toBe(
      'https://mastra.slack.com/archives/C2/p1800000000000001?thread_ts=1700000200.000200&cid=C2',
    );
  });

  it('refuses Slack Connect, outsiders, bots, other DMs, private channels and its own thread', async () => {
    const { run, postMessage } = await slackSession();
    await expect(run(SLACK_SEND_TOOL_NAME, { to: 'CSHARED', text: 'x' })).rejects.toThrow(/Slack Connect/);
    await expect(run(SLACK_SEND_TOOL_NAME, { to: 'UOUTSIDE', text: 'x' })).rejects.toThrow(
      /outside this Slack workspace/,
    );
    await expect(run(SLACK_SEND_TOOL_NAME, { to: 'UBOT', text: 'x' })).rejects.toThrow(/bot/);
    await expect(run(SLACK_SEND_TOOL_NAME, { to: 'DOTHER', text: 'x' })).rejects.toThrow(/direct message/);
    await expect(run(SLACK_SEND_TOOL_NAME, { to: 'GSECRET', text: 'x' })).rejects.toThrow(/not in/);
    await expect(run(SLACK_SEND_TOOL_NAME, { to: 'C1', thread: '171.1', text: 'x' })).rejects.toThrow(
      /reply_in_thread/,
    );
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('explains a missing scope instead of surfacing the raw API error', async () => {
    const { run, apiCall } = await slackSession();
    apiCall.mockRejectedValueOnce(
      Object.assign(new Error('missing_scope'), { data: { error: 'missing_scope', needed: 'channels:history' } }),
    );
    await expect(run(SLACK_READ_TOOL_NAME, { target: 'C2' })).rejects.toThrow(/missing the `channels:history` scope/);
  });
});
