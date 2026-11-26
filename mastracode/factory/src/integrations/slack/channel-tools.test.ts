import { MessageList } from '@mastra/core/agent';
import { AgentControllerChannels, ChannelToolAnnouncementProcessor, REPLY_TOOL_NAME } from '@mastra/core/channels';
import type { ProcessInputStepArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { SlackIntegration } from './integration.js';

function ctxWith() {
  return {
    storage: { channelIdentity: {}, projects: {}, memorySettings: {} },
    runtime: { workItems: { findRunBindingByThread: async () => null } },
  } as any;
}

/** Runs the channels' input processors on one step, as the agent does, and returns the step's tools. */
async function stepTools(channels: AgentControllerChannels, requestContext: RequestContext) {
  let tools: Record<string, unknown> = {};
  for (const processor of channels.getInputProcessors()) {
    const result = await processor.processInputStep?.({
      messageList: new MessageList({}),
      requestContext,
      tools,
      state: {},
    } as unknown as ProcessInputStepArgs);
    if (result && 'tools' in result && result.tools) tools = result.tools as Record<string, unknown>;
  }
  return tools;
}

type Execute = { execute: (input: Record<string, unknown>, ctx: Record<string, unknown>) => Promise<unknown> };

/**
 * A Factory with Slack attached: real channels reading the session's thread
 * from storage, the way a web prompt or a woken run finds its Slack thread.
 */
async function factoryWithSlack({
  threadMetadata = { channel_platform: 'slack', channel_externalThreadId: 'slack:C1:171.1' } as Record<string, unknown>,
  textDisplay,
  bindChannels = true,
}: { threadMetadata?: Record<string, unknown>; textDisplay?: 'show' | 'hidden'; bindChannels?: boolean } = {}) {
  const storage = new InMemoryStore();
  const memory = await storage.getStore('memory');
  await memory!.saveThread({
    thread: {
      id: 'thread-1',
      resourceId: 'resource-1',
      title: 'session',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: threadMetadata,
    },
  });
  const getThreadById = vi.spyOn(memory!, 'getThreadById');

  const post = vi.fn(async () => ({}));
  const adapter = { name: 'slack', startTyping: vi.fn() };
  const slack = new SlackIntegration({
    signingSecret: 'secret',
    ...(textDisplay ? { adapterOptions: { textDisplay } } : {}),
  });
  // The display options Factory hands to channels, with the test adapter in place of Slack's.
  const { adapter: _real, ...options } = slack.channels(ctxWith()).adapters.slack as Record<string, unknown>;
  const channels = new AgentControllerChannels({
    adapters: { slack: { ...options, adapter, streaming: false } as any },
  });
  channels.__setController({ id: 'mastra-code', getMastra: () => ({ getStorage: () => storage }) } as any);
  (channels as any).chat = { thread: (id: string) => ({ id, adapter, post }), getAdapter: () => adapter };

  if (bindChannels) slack.initialize({ channels: () => channels });

  const requestContext = new RequestContext();
  requestContext.set('controller', {
    threadId: 'thread-1',
    sessionId: 'session-1',
    resourceId: 'resource-1',
    getState: () => ({}),
    workspace: {
      filesystem: {
        stat: vi.fn(async () => ({ type: 'file', size: 4, mimeType: 'application/pdf' })),
        readFile: vi.fn(async () => Buffer.from('data')),
      },
    },
  });
  return { slack, channels, requestContext, post, getThreadById };
}

describe('Slack channel tools', () => {
  it('gives a web prompt on a Slack-linked session attach_file and reply_in_thread, posting into the recorded thread', async () => {
    const { slack, channels, requestContext, post } = await factoryWithSlack();

    const tools = await slack.agentTools({ requestContext });
    expect(Object.keys(tools)).toContain('attach_file');
    expect(Object.keys(tools)).not.toContain(REPLY_TOOL_NAME);
    const reply = (await stepTools(channels, requestContext))[REPLY_TOOL_NAME];
    expect(reply).toBeDefined();

    await (reply as unknown as Execute).execute({ text: 'Done: tests pass.' }, {});
    expect(post).toHaveBeenCalledWith({ markdown: 'Done: tests pass.' });
    await (tools.attach_file as unknown as Execute).execute({ path: '/workspace/report.pdf' }, {});
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({ files: [expect.objectContaining({ filename: 'report.pdf' })] }),
    );
  });

  it('reads the thread once to decide, and not at all on a run that came from Slack', async () => {
    const linked = await factoryWithSlack();
    await linked.slack.agentTools({ requestContext: linked.requestContext });
    expect(linked.getThreadById).toHaveBeenCalledTimes(1);

    const fromSlack = await factoryWithSlack();
    fromSlack.requestContext.set('channel', { platform: 'slack', isDM: false });
    const tools = await fromSlack.slack.agentTools({ requestContext: fromSlack.requestContext });
    expect(Object.keys(tools)).toContain('attach_file');
    expect(fromSlack.getThreadById).not.toHaveBeenCalled();
  });

  it('gives a plain web session, a subagent fork, or an unmounted controller no channel tools', async () => {
    const plain = await factoryWithSlack({ threadMetadata: { forkedSubagent: true } });
    await expect(plain.slack.agentTools({ requestContext: plain.requestContext })).resolves.toEqual({});
    expect(await stepTools(plain.channels, plain.requestContext)).not.toHaveProperty(REPLY_TOOL_NAME);

    const unbound = await factoryWithSlack({ bindChannels: false });
    await expect(unbound.slack.agentTools({ requestContext: unbound.requestContext })).resolves.toEqual({});
  });

  it('leaves out the reply tool when reply text is shown', async () => {
    const { channels, requestContext } = await factoryWithSlack({ textDisplay: 'show' });
    expect(await stepTools(channels, requestContext)).not.toHaveProperty(REPLY_TOOL_NAME);
  });

  it('adds only the pull request announcer as its own output processor', async () => {
    const { slack } = await factoryWithSlack();
    expect(slack.processors.output.map(p => p.constructor)).toEqual([ChannelToolAnnouncementProcessor]);
  });
});
