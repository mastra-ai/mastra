import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import type { ChannelToolsOptions } from '../chat-tools';
import { createChannelTools } from '../chat-tools';

/**
 * A chat platform with Slack-shaped ids (`test:<channel>:<ts>`, DMs start
 * with `D`), so the real Chat SDK resolves channels, DMs and posts through it.
 */
function createAdapter() {
  return {
    name: 'test',
    userName: 'TestBot',
    initialize: vi.fn().mockResolvedValue(undefined),
    handleWebhook: vi.fn().mockResolvedValue(new Response('ok')),
    encodeThreadId: (parts: { channel: string; ts: string }) => `test:${parts.channel}:${parts.ts}`,
    decodeThreadId: (id: string) => {
      const [, channel, ts] = id.split(':');
      return { channel, ts };
    },
    channelIdFromThreadId: (id: string) => id.split(':').slice(0, 2).join(':'),
    isDM: (id: string) => (id.split(':')[1] ?? '').startsWith('D'),
    postMessage: vi.fn(async (threadId: string) => ({ id: 'posted-1', threadId, raw: {} })),
    postChannelMessage: vi.fn(async (channelId: string) => ({ id: 'posted-2', threadId: channelId, raw: {} })),
    fetchMessages: vi.fn(async () => ({ messages: [] })),
    fetchChannelMessages: vi.fn(async () => ({ messages: [] })),
    fetchThread: vi.fn(async (id: string) => ({ id, channelId: id.split(':').slice(0, 2).join(':'), metadata: {} })),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
    addReaction: vi.fn(),
    removeReaction: vi.fn(),
    startTyping: vi.fn(),
    renderFormatted: (text: string) => text,
    parseMessage: (raw: unknown) => raw,
  } as any;
}

const OWN_THREAD = 'test:C1:1700000000.000100';

async function setup(options: ChannelToolsOptions = {}, adapter = createAdapter()) {
  const agent = new Agent({
    id: 'channel-agent',
    name: 'channel-agent',
    instructions: 'test',
    model: new MockLanguageModelV2(),
    channels: { adapters: { test: adapter } },
  });
  const mastra = new Mastra({ agents: { agent }, logger: false });
  await agent.getChannels()!.initialize(mastra);
  const tools = (await createChannelTools(options)) as Record<
    string,
    { execute: (input: unknown, ctx: unknown) => Promise<unknown> }
  >;
  // A run started by a message in OWN_THREAD.
  const requestContext = new RequestContext();
  requestContext.set('channel', { platform: 'test', threadId: OWN_THREAD });
  const context = { requestContext, mastra, agent: { agentId: 'channel-agent' } };
  const run = (name: string, input: unknown) => tools[name]!.execute(input, context);
  return { adapter, tools, run };
}

describe('createChannelTools', () => {
  it('reads and posts in the run conversation’s own channel', async () => {
    const { adapter, run } = await setup();

    await run('fetchMessages', { threadId: OWN_THREAD });
    expect(adapter.fetchMessages).toHaveBeenCalledWith(OWN_THREAD, expect.anything());

    await run('postMessage', { threadId: 'test:C1:1700000000.000200', message: 'hi' });
    expect(adapter.postMessage).toHaveBeenCalledWith('test:C1:1700000000.000200', expect.anything());
  });

  it('refuses a channel outside the allowed set', async () => {
    const { adapter, run } = await setup();

    await expect(run('fetchChannelMessages', { channelId: 'test:C2' })).rejects.toThrow(
      'outside the channels this conversation can use',
    );
    await expect(run('postChannelMessage', { channelId: 'test:C2', message: 'hi' })).rejects.toThrow(
      'outside the channels this conversation can use',
    );
    expect(adapter.fetchChannelMessages).not.toHaveBeenCalled();
    expect(adapter.postChannelMessage).not.toHaveBeenCalled();
  });

  it('allows selected channels, and every channel with `all`', async () => {
    const selected = await setup({ channels: 'selected', channelIds: ['test:C2'] });
    await selected.run('fetchChannelMessages', { channelId: 'test:C2' });
    await expect(selected.run('fetchChannelMessages', { channelId: 'test:C3' })).rejects.toThrow('outside');

    const all = await setup({ channels: 'all' });
    await all.run('fetchChannelMessages', { channelId: 'test:C3' });
    expect(all.adapter.fetchChannelMessages).toHaveBeenCalledWith('test:C3', expect.anything());
  });

  it('never reads someone else’s direct message, even with every channel granted', async () => {
    const { adapter, run } = await setup({ channels: 'all', directMessages: 'anyone' });

    await expect(run('fetchMessages', { threadId: 'test:D9:1700000000.000100' })).rejects.toThrow(
      "someone else's direct message",
    );
    await expect(run('fetchChannelMessages', { channelId: 'test:D9' })).rejects.toThrow(
      "someone else's direct message",
    );
    expect(adapter.fetchMessages).not.toHaveBeenCalled();
    expect(adapter.fetchChannelMessages).not.toHaveBeenCalled();
  });

  it('never reads a group DM the platform only reports as a DM in its channel info', async () => {
    const adapter = createAdapter();
    // Like Slack: `isDM` only knows 1:1 DMs, the channel info knows group DMs.
    adapter.fetchChannelInfo = vi.fn(async (id: string) => ({ id, isDM: id === 'test:G9', metadata: {} }));
    const { run } = await setup({ channels: 'all' }, adapter);

    await expect(run('fetchChannelMessages', { channelId: 'test:G9' })).rejects.toThrow(
      "someone else's direct message",
    );
    await expect(run('fetchMessages', { threadId: 'test:G9:1700000000.000100' })).rejects.toThrow(
      "someone else's direct message",
    );
    await run('fetchChannelMessages', { channelId: 'test:C3' });
    expect(adapter.fetchChannelMessages).toHaveBeenCalledTimes(1);
    expect(adapter.fetchChannelMessages).toHaveBeenCalledWith('test:C3', expect.anything());
  });

  it('rejects channelIds without the platform prefix', async () => {
    await expect(setup({ channels: 'selected', channelIds: ['C2'] })).rejects.toThrow(
      'channelIds must be full chat ids',
    );
  });

  it('only allows channels granted by id when the platform cannot tell DMs apart', async () => {
    const adapter = createAdapter();
    delete adapter.isDM;

    const all = await setup({ channels: 'all' }, adapter);
    await all.run('fetchMessages', { threadId: OWN_THREAD });
    await expect(all.run('fetchChannelMessages', { channelId: 'test:D9' })).rejects.toThrow(
      "can't be checked for being someone else's direct message",
    );

    const selected = await setup({ channels: 'selected', channelIds: ['test:C2'] }, adapter);
    await selected.run('fetchChannelMessages', { channelId: 'test:C2' });
    expect(adapter.fetchChannelMessages).toHaveBeenCalledTimes(1);
    expect(adapter.fetchChannelMessages).toHaveBeenCalledWith('test:C2', expect.anything());
  });

  it('with read access, refuses to send direct messages', async () => {
    const { adapter, run } = await setup({ access: 'read', directMessages: 'anyone' });
    adapter.openDM = vi.fn();

    await expect(run('sendDirectMessage', { userId: 'U2', message: 'hi' })).rejects.toThrow('read only');
    expect(adapter.openDM).not.toHaveBeenCalled();
    expect(adapter.postMessage).not.toHaveBeenCalled();
  });

  it('with read access, posts only in the conversation’s own channel', async () => {
    const { adapter, run } = await setup({ channels: 'all', access: 'read' });

    await run('fetchChannelMessages', { channelId: 'test:C2' });
    await expect(run('postChannelMessage', { channelId: 'test:C2', message: 'hi' })).rejects.toThrow('read only');
    await expect(run('postMessage', { threadId: 'test:C2:1700000000.000100', message: 'hi' })).rejects.toThrow(
      'read only',
    );
    expect(adapter.postChannelMessage).not.toHaveBeenCalled();

    await run('postMessage', { threadId: OWN_THREAD, message: 'hi' });
    expect(adapter.postMessage).toHaveBeenCalledWith(OWN_THREAD, expect.anything());
  });

  it('rejects ids without a platform prefix and thread ids given as channels', async () => {
    const { run } = await setup({ channels: 'all' });

    await expect(run('fetchChannelMessages', { channelId: 'C2' })).rejects.toThrow("isn't a full chat id");
    await expect(run('postChannelMessage', { channelId: OWN_THREAD, message: 'hi' })).rejects.toThrow(
      'is a thread, not a channel',
    );
  });

  it('offers sendDirectMessage only when direct messages are allowed', async () => {
    expect((await setup()).tools.sendDirectMessage).toBeUndefined();
    expect((await setup({ directMessages: 'anyone' })).tools.sendDirectMessage).toBeDefined();
  });

  it('fails clearly outside a channel run', async () => {
    const tools = (await createChannelTools()) as Record<
      string,
      { execute: (i: unknown, c: unknown) => Promise<unknown> }
    >;
    await expect(
      tools.fetchMessages!.execute({ threadId: OWN_THREAD }, { requestContext: new RequestContext() }),
    ).rejects.toThrow('Channel tools only work for an agent with channels');
  });
});
