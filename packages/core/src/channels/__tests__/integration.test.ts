import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { Message } from 'chat';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Agent } from '../../agent';
import { createDurableAgent, createEventedAgent } from '../../agent/durable';
import { DurableStepIds } from '../../agent/durable/constants';
import { ConsoleLogger } from '../../logger';
import { useLoopScenarioAimock } from '../../loop/test-utils/aimock/aimock-scenario';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { createTool } from '../../tools';
import { AgentChannels } from '../agent-channels';
import type { ChannelConfig } from '../types';

// Minimal mock adapter satisfying the Chat SDK Adapter interface
function createMockAdapter(name: string) {
  return {
    name,
    postMessage: async () => ({ id: 'msg-1', text: '' }),
    editMessage: async () => {},
    deleteMessage: async () => {},
    addReaction: async () => {},
    removeReaction: async () => {},
    handleWebhook: async () => new Response('ok'),
    initialize: async () => {},
    fetchMessages: async () => [],
    encodeThreadId: (...parts: string[]) => parts.join(':'),
    decodeThreadId: (id: string) => id.split(':'),
    channelIdFromThreadId: (id: string) => id.split(':').slice(0, 2).join(':'),
    renderFormatted: (t: string) => t,
    fetchThread: async () => null,
    startTyping: async () => {},
    parseMessage: (raw: unknown) => raw,
    userName: 'Bot',
  } as any;
}

function createTestAgent(id: string, options?: { channels?: ChannelConfig }) {
  return new Agent({
    id,
    name: `Test Agent ${id}`,
    instructions: 'You are a test agent',
    model: new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text', text: 'Hello' }],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 't-1' },
          { type: 'text-delta', id: 't-1', delta: 'Hello' },
          { type: 'text-end', id: 't-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      }),
    }),
    channels: options?.channels,
  });
}

describe('Mastra Channel Integration', () => {
  describe('agent-level channel registration', () => {
    it('creates AgentChannels when channels are provided', () => {
      const agent = createTestAgent('bot-1', {
        channels: { adapters: { discord: createMockAdapter('discord') } },
      });
      expect(agent.getChannels()).not.toBeNull();
    });

    it('returns null AgentChannels when no channels', () => {
      const agent = createTestAgent('no-channels');
      expect(agent.getChannels()).toBeNull();
    });

    it('exposes adapters through AgentChannels', () => {
      const agent = createTestAgent('bot-1', {
        channels: {
          adapters: {
            discord: createMockAdapter('discord'),
            slack: createMockAdapter('slack'),
          },
        },
      });
      const channels = agent.getChannels()!;
      expect(Object.keys(channels.adapters)).toEqual(['discord', 'slack']);
    });
  });

  describe('mastra-level channel aggregation', () => {
    it('aggregates AgentChannels instances from agents', () => {
      const agent1 = createTestAgent('agent1', {
        channels: { adapters: { discord: createMockAdapter('discord') } },
      });
      const agent2 = createTestAgent('agent2', {
        channels: { adapters: { slack: createMockAdapter('slack') } },
      });

      const mastra = new Mastra({
        logger: false,
        agents: { agent1, agent2 },
        storage: new InMemoryStore(),
      });

      const channels = mastra.getChannels();
      expect(Object.keys(channels)).toEqual(['agent1', 'agent2']);
    });

    it('returns empty when no agents have channels', () => {
      const agent = createTestAgent('no-channels');
      const mastra = new Mastra({
        logger: false,
        agents: { agent },
      });
      expect(mastra.getChannels()).toEqual({});
    });
  });

  describe('logger propagation', () => {
    it('propagates the Mastra logger to AgentChannels when registered', () => {
      const agent = createTestAgent('bot-1', {
        channels: { adapters: { discord: createMockAdapter('discord') } },
      });

      const mastra = new Mastra({
        agents: { 'bot-1': agent },
        storage: new InMemoryStore(),
      });

      const channels = mastra.getChannels()['bot-1']!;
      // AgentChannels.__setLogger stores the logger on its internal field; assert
      // a logger has been propagated from the agent (Mastra wires a DualLogger
      // on register) rather than remaining unset.
      const channelLogger = (channels as any).logger;
      expect(channelLogger).toBeDefined();
      expect(typeof channelLogger.info).toBe('function');
      expect(typeof channelLogger.debug).toBe('function');
      expect(typeof channelLogger.warn).toBe('function');
    });
  });

  describe('webhook route auto-wiring', () => {
    it('adds channel webhook routes to server config', () => {
      const agent = createTestAgent('bot-1', {
        channels: { adapters: { discord: createMockAdapter('discord') } },
      });

      const mastra = new Mastra({
        logger: false,
        agents: { 'bot-1': agent },
        storage: new InMemoryStore(),
      });

      const server = mastra.getServer();
      const paths = (server?.apiRoutes ?? []).map(r => r.path);
      expect(paths).toContain('/api/agents/bot-1/channels/discord/webhook');
    });

    it('merges channel routes with existing server routes', () => {
      const agent = createTestAgent('bot-1', {
        channels: { adapters: { discord: createMockAdapter('discord') } },
      });

      const mastra = new Mastra({
        logger: false,
        agents: { 'bot-1': agent },
        storage: new InMemoryStore(),
        server: {
          apiRoutes: [
            {
              path: '/api/custom',
              method: 'GET',
              createHandler: async () => async () => new Response('ok'),
            },
          ],
        },
      });

      const server = mastra.getServer();
      const paths = (server?.apiRoutes ?? []).map(r => r.path);
      expect(paths).toContain('/api/custom');
      expect(paths).toContain('/api/agents/bot-1/channels/discord/webhook');
      expect(paths.length).toBe(2);
    });
  });

  describe('channel initialization error handling', () => {
    it('logs an error instead of swallowing the rejection when channel initialization fails', async () => {
      const logger = new ConsoleLogger({ level: 'error' });
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      // Force initialization to fail. Registration fires channel init as a
      // background promise; previously that rejection was swallowed by an
      // un-awaited `void initialize()`, leaving the channel silently dead.
      const initSpy = vi
        .spyOn(AgentChannels.prototype, 'initialize')
        .mockRejectedValue(new Error('channel init failed'));

      try {
        const agent = createTestAgent('bot-1', {
          channels: { adapters: { discord: createMockAdapter('discord') } },
        });

        new Mastra({ logger, agents: { 'bot-1': agent }, storage: new InMemoryStore() });

        await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to initialize channels for agent bot-1'),
          expect.any(Error),
        );
      } finally {
        initSpy.mockRestore();
      }
    });
  });
});

// Exercise the Chat SDK ingress, not wrapper.stream(): binding the inner Agent
// still renders a reply but silently loses durable snapshots and observation.
describe.each(['plain', 'durable', 'evented'] as const)('%s inbound channel execution', engine => {
  const getLLM = useLoopScenarioAimock();

  it.each([
    { attachment: 'late', decision: undefined },
    { attachment: 'config', decision: undefined },
    { attachment: 'instance', decision: undefined },
    { attachment: 'replacement', decision: undefined },
    { attachment: 'late', decision: 'approve' },
    { attachment: 'late', decision: 'deny' },
  ] as const)(
    'keeps the execution owner with $attachment channels ($decision)',
    async ({ attachment, decision }) => {
      const llm = getLLM();
      if (decision) {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'approval-1', name: 'sendEmail', arguments: { to: 'alice@example.com' } }],
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Channel answer' });
      } else {
        llm.on({ endpoint: 'chat' }, { content: 'Channel answer' });
      }
      const execute = vi.fn(async () => ({ sent: true }));
      const gate = Promise.withResolvers<void>();
      // Hold the real provider's HTTP request so snapshots can be inspected
      // before evented terminal cleanup deletes them.
      const server = createServer(async (request, response) => {
        const body: Buffer[] = [];
        for await (const chunk of request) body.push(Buffer.from(chunk));
        await gate.promise;
        const upstream = await fetch(`${llm.url}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: Buffer.concat(body),
        });
        response.writeHead(upstream.status, Object.fromEntries(upstream.headers));
        response.end(Buffer.from(await upstream.arrayBuffer()));
      });
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Missing model server address');
      const storage = new InMemoryStore();
      const adapter = createMockAdapter('slack');
      adapter.userName = 'TestBot';
      adapter.isDM = () => false;
      adapter.fetchMessages = async () => ({ messages: [] });
      adapter.postMessage = vi.fn(async () => ({ id: 'reply', text: '' }));
      adapter.editMessage = vi.fn(async () => {});
      const testId = `${engine}-${attachment}-${decision ?? 'message'}-${randomUUID()}`;
      const threadId = `thread-${testId}`;
      const resourceId = 'channel-user';
      const config = {
        adapters: { slack: { adapter, streaming: false } },
        resolveThreadId: () => threadId,
        resolveResourceId: () => resourceId,
      };
      let channels = new AgentChannels(config);
      const runIds = new Set<string>();
      const inner = new Agent({
        id: `channel-${testId}`,
        name: 'TestBot',
        instructions: 'Answer the message.',
        model: createOpenAI({ baseURL: `http://127.0.0.1:${address.port}/v1`, apiKey: 'test' }).chat('gpt-4o'),
        memory: new MockMemory({ storage }),
        tools: decision
          ? {
              sendEmail: createTool({
                id: 'sendEmail',
                description: 'Send an email',
                inputSchema: z.object({ to: z.string().email() }),
                requireApproval: true,
                execute,
              }),
            }
          : undefined,
        ...(attachment === 'config' ? { channels: config } : attachment === 'instance' ? { channels } : {}),
      });
      const agent =
        engine === 'plain'
          ? inner
          : engine === 'durable'
            ? createDurableAgent({ agent: inner })
            : createEventedAgent({ agent: inner });
      if (attachment === 'late' || attachment === 'replacement') agent.setChannels(channels);
      else channels = agent.getChannels()!;
      const mastra = new Mastra({ logger: false, storage, agents: { agent } });
      const workflowEvents: string[] = [];
      let detach: (() => void) | undefined;
      let delivery: Promise<void> | undefined;
      const subscription = await agent.subscribeToThread({ threadId, resourceId });
      const subscribed = (async () => {
        for await (const part of subscription.stream) {
          if (part.runId) runIds.add(part.runId);
        }
      })();
      try {
        await mastra.startWorkers();
        await mastra.pubsub.subscribe('workflows', async event => {
          workflowEvents.push(event.type);
        });
        if (engine === 'evented' && 'getWorkflow' in agent) {
          expect(agent.getWorkflow().engineType).toBe('evented');
        }
        await channels.initialize(mastra);
        if (attachment === 'replacement') {
          await channels.close();
          channels = new AgentChannels(config);
          agent.setChannels(channels);
          agent.setChannels(channels);
          await channels.initialize(mastra);
        }
        expect(agent.getChannels()).toBe(channels);
        expect(inner.getChannels()).toBe(channels);
        const message: Message = {
          id: 'inbound-1',
          threadId: 'C1:thread',
          text: '@TestBot hello',
          formatted: { type: 'root', children: [] },
          raw: {},
          attachments: [],
          author: { userId: 'U1', userName: 'alice', fullName: 'Alice', isBot: false, isMe: false },
          metadata: { dateSent: new Date(), edited: false },
        };
        const sdk = channels.sdk as unknown as {
          processMessage(adapter: unknown, threadId: string, message: Message): Promise<void>;
        };
        delivery = sdk.processMessage(adapter, message.threadId, message);
        await vi.waitFor(() => expect(subscription.activeRunId()).toBeTruthy(), { timeout: 5000 });
        const runId = subscription.activeRunId()!;
        runIds.add(runId);
        let observed: Promise<string> | undefined;
        if (engine !== 'plain' && 'observe' in agent) {
          const workflows = await storage.getStore('workflows');
          await vi.waitFor(
            async () => {
              const snapshot = await workflows!.getWorkflowRunById({
                runId,
                workflowName: DurableStepIds.AGENTIC_LOOP,
              });
              expect(snapshot, 'inbound turns must persist a durable run').not.toBeNull();
            },
            { timeout: 5000 },
          );
          if (!decision) {
            const observer = await agent.observe(runId);
            detach = observer.detach;
            observed = (async () => {
              let text = '';
              for await (const part of observer.fullStream) {
                if (part.type === 'text-delta') text += part.payload.text;
              }
              return text;
            })();
          }
        }
        gate.resolve();
        if (decision) {
          await vi.waitFor(
            () => {
              expect(JSON.stringify([adapter.postMessage.mock.calls, adapter.editMessage.mock.calls])).toContain(
                'tool_approve:approval-1',
              );
            },
            { timeout: 5000 },
          );
          expect(execute).not.toHaveBeenCalled();
          const actions = channels.sdk as unknown as {
            processAction(event: unknown): Promise<void>;
          };
          await actions.processAction({
            actionId: `tool_${decision}:approval-1`,
            adapter,
            messageId: 'reply',
            threadId: message.threadId,
            thread: { id: message.threadId, channelId: 'C1', isDM: false },
            user: message.author,
            raw: {},
          });
        }
        await vi.waitFor(
          () => {
            expect(JSON.stringify(adapter.postMessage.mock.calls)).toContain('Channel answer');
          },
          { timeout: 5000 },
        );
        expect(execute).toHaveBeenCalledTimes(decision === 'approve' ? 1 : 0);
        expect(adapter.postMessage).toHaveBeenCalledTimes(decision ? 2 : 1);
        expect(llm.getRequests()).toHaveLength(decision ? 2 : 1);
        expect(runIds.size).toBe(1);
        if (engine === 'evented') {
          expect(workflowEvents).toContain('workflow.start');
          expect(workflowEvents.some(type => type.startsWith('workflow.step'))).toBe(true);
        }
        subscription.abort();
        await delivery;
        if (observed) expect(await observed).toContain('Channel answer');
      } finally {
        gate.resolve();
        subscription.abort();
        detach?.();
        await delivery;
        await subscription.unsubscribe();
        await subscribed;
        await channels.close();
        await mastra.stopWorkers();
        await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
      }
    },
    20_000,
  );
});
