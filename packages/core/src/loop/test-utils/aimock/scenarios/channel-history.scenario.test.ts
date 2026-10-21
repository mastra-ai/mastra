import { randomUUID } from 'node:crypto';
import type { Message } from 'chat';
import { expect, it, vi } from 'vitest';
import { AgentChannels } from '../../../../channels/agent-channels';
import { MockMemory } from '../../../../memory/mock';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

describeForAllEngines('AIMock loop scenario: channel thread history', engine => {
  const getMock = useLoopScenarioAimock();

  it('persists prior platform messages when a channel thread first reaches the agent', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'Channel answer' });
    const memory = new MockMemory();
    const { agent, mastra } = await createSharedAgent(llm, { engine, memory });
    const threadId = `channel-history-${randomUUID()}`;
    const resourceId = 'channel-user';
    const externalThreadId = 'C1:thread';
    const adapter = {
      name: 'slack',
      userName: 'TestBot',
      isDM: () => false,
      postMessage: vi.fn(async () => ({ id: 'reply', text: '' })),
      editMessage: vi.fn(async () => {}),
      deleteMessage: async () => {},
      addReaction: async () => {},
      removeReaction: async () => {},
      handleWebhook: async () => new Response('ok'),
      initialize: async () => {},
      encodeThreadId: (...parts: string[]) => parts.join(':'),
      decodeThreadId: (id: string) => id.split(':'),
      channelIdFromThreadId: (id: string) => id.split(':').slice(0, 2).join(':'),
      renderFormatted: (text: string) => text,
      fetchThread: async () => null,
      startTyping: async () => {},
      parseMessage: (raw: unknown) => raw,
    } as any;
    const channels = new AgentChannels({
      adapters: { slack: { adapter, streaming: false } },
      resolveThreadId: () => threadId,
      resolveResourceId: () => resourceId,
    });
    agent.setChannels(channels);
    const historyMemoryReads: string[] = [];
    const getMemory = agent.getMemory.bind(agent);
    vi.spyOn(agent, 'getMemory').mockImplementation((...args) => {
      historyMemoryReads.push(new Error().stack ?? '');
      return getMemory(...args);
    });
    const message: Message = {
      id: 'inbound-1',
      threadId: externalThreadId,
      text: '@TestBot hello',
      formatted: { type: 'root', children: [] },
      raw: {},
      attachments: [],
      author: { userId: 'U1', userName: 'alice', fullName: 'Alice', isBot: false, isMe: false },
      metadata: { dateSent: new Date(), edited: false },
    };
    adapter.fetchMessages = async () => ({
      messages: [
        {
          ...message,
          id: 'prior-1',
          text: 'Earlier question from the platform thread',
          metadata: { dateSent: new Date(Date.now() - 60_000), edited: false },
        },
      ],
    });
    let delivery: Promise<void> | undefined;
    try {
      await mastra.startWorkers();
      await channels.initialize(mastra);
      const sdk = channels.sdk as unknown as {
        processMessage(adapter: unknown, threadId: string, message: Message): Promise<void>;
      };
      delivery = sdk.processMessage(adapter, externalThreadId, message);
      await vi.waitFor(
        () => {
          expect(JSON.stringify(adapter.postMessage.mock.calls)).toContain('Channel answer');
        },
        { timeout: 15000 },
      );
      const memoryStore = await memory.storage.getStore('memory');
      const { messages } = await memoryStore!.listMessages({ threadId, perPage: 100 });
      const history = messages.filter(row => row.id === `thread-history:${threadId}:prior-1`);
      expect(history).toHaveLength(1);
      expect(history[0]?.content.metadata?.signal?.attributes).toMatchObject({
        source: 'thread-history',
        messageId: 'prior-1',
      });
      expect(JSON.stringify(history[0]?.content)).toContain('Earlier question from the platform thread');
      expect(historyMemoryReads.some(stack => stack.includes('persistThreadHistorySignals'))).toBe(true);
      expect(llm.getRequests()).toHaveLength(1);
      expect(JSON.stringify(llm.getRequests()[0]?.body?.messages)).toContain('@TestBot hello');
    } finally {
      await delivery;
      await channels.close();
      await mastra.stopWorkers();
    }
  }, 30_000);
});
