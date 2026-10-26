import { AgentControllerChannels } from '@mastra/core/channels';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { FactoryChannelReplyProcessor } from './channel-reply-processor.js';
import { FactoryChannelSessionLinkProcessor } from './channel-session-link-processor.js';
import { SlackIntegration } from './integration.js';
import { FactoryReplyReminderProcessor } from './reply-reminder-processor.js';
import { FactoryReplyStreamProcessor, REPLY_TOOL_NAME } from './reply-tool.js';

type Execute = { execute: (input: Record<string, unknown>, ctx: Record<string, unknown>) => Promise<unknown> };

/**
 * A Factory with Slack attached: real channels reading the session's thread
 * from storage, the way a web prompt or a woken run finds its Slack thread.
 */
async function factoryWithSlack({
  threadMetadata = { channel_platform: 'slack', channel_externalThreadId: 'slack:C1:171.1' } as Record<
    string,
    unknown
  >,
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
  const channels = new AgentControllerChannels({ adapters: { slack: { adapter, streaming: false } as any } });
  channels.__setController({ id: 'mastra-code', getMastra: () => ({ getStorage: () => storage }) } as any);
  (channels as any).chat = { thread: (id: string) => ({ id, adapter, post }) };

  const slack = new SlackIntegration({
    signingSecret: 'secret',
    ...(textDisplay ? { adapterOptions: { textDisplay } } : {}),
  });
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
  return { slack, requestContext, post, getThreadById };
}

describe('Slack channel tools', () => {
  it('gives a web prompt on a Slack-linked session both tools, posting into the recorded thread', async () => {
    const { slack, requestContext, post } = await factoryWithSlack();

    const tools = await slack.agentTools({ requestContext });
    expect(Object.keys(tools).sort()).toEqual(['attach_file', REPLY_TOOL_NAME]);

    await (tools[REPLY_TOOL_NAME] as unknown as Execute).execute({ text: 'Done: tests pass.' }, {});
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
    expect(Object.keys(tools).sort()).toEqual(['attach_file', REPLY_TOOL_NAME]);
    expect(fromSlack.getThreadById).not.toHaveBeenCalled();
  });

  it('gives a plain web session, a subagent fork, or an unmounted controller no channel tools', async () => {
    const plain = await factoryWithSlack({ threadMetadata: { forkedSubagent: true } });
    await expect(plain.slack.agentTools({ requestContext: plain.requestContext })).resolves.toEqual({});

    const unbound = await factoryWithSlack({ bindChannels: false });
    await expect(unbound.slack.agentTools({ requestContext: unbound.requestContext })).resolves.toEqual({});
  });

  it('leaves out the reply tool, its reminder and its streaming when reply text is shown', async () => {
    const { slack, requestContext } = await factoryWithSlack({ textDisplay: 'show' });

    expect(Object.keys(await slack.agentTools({ requestContext }))).toEqual(['attach_file']);
    expect(slack.processors.input.map(p => p.constructor)).toEqual([FactoryChannelReplyProcessor]);
    expect(slack.processors.output.map(p => p.constructor)).toEqual([FactoryChannelSessionLinkProcessor]);
  });

  it('hides reply text by default, so the reply tool comes with its reminder and streaming', async () => {
    const { slack } = await factoryWithSlack();

    expect(slack.processors.input.map(p => p.constructor)).toEqual([
      FactoryChannelReplyProcessor,
      FactoryReplyReminderProcessor,
    ]);
    expect(slack.processors.output.map(p => p.constructor)).toEqual([
      FactoryChannelSessionLinkProcessor,
      FactoryReplyStreamProcessor,
    ]);
  });
});
