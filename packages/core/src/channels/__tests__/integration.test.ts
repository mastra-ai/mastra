import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { Message } from 'chat';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Agent } from '../../agent';
import { createDurableAgent, createEventedAgent, EventedAgent } from '../../agent/durable';
import { DurableStepIds } from '../../agent/durable/constants';
import { ConsoleLogger } from '../../logger';
import { useLoopScenarioAimock } from '../../loop/test-utils/aimock/aimock-scenario';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage/mock';
import { createTool } from '../../tools';
import { AgentChannels } from '../agent-channels';
import { ChatChannelGenerativeUIProcessor } from '../generative-ui';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '../output-processor';
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

const seenRunIds = new Set<string>();

// Exercise the Chat SDK ingress, not wrapper.stream(): binding the inner Agent
// still renders a reply but silently loses durable snapshots and observation.
describe.each(['plain', 'durable', 'evented'] as const)('%s inbound channel execution', engine => {
  const getLLM = useLoopScenarioAimock();

  it.each([
    { attachment: 'late', decision: undefined },
    { attachment: 'late-history', decision: undefined },
    { attachment: 'config', decision: undefined },
    { attachment: 'instance', decision: undefined },
    { attachment: 'replacement', decision: undefined },
    { attachment: 'late', decision: 'approve' },
    { attachment: 'late', decision: 'deny' },
    ...(engine === 'plain'
      ? []
      : ([
          { attachment: 'fork', decision: undefined },
          { attachment: 'fork', decision: 'approve' },
          { attachment: 'fork', decision: 'deny' },
          { attachment: 'rebind', decision: undefined },
          { attachment: 'id-config', decision: undefined },
          { attachment: 'id-fork', decision: undefined },
          { attachment: 'id-late', decision: undefined },
          { attachment: 'id-late', decision: 'approve' },
          { attachment: 'id-late', decision: 'deny' },
        ] as const)),
  ] as const)(
    'keeps the execution owner with $attachment channels ($decision)',
    async ({ attachment, decision }) => {
      // Durable run IDs bypass Mastra.generateId; don't reuse the global UUID
      // fixture's sequence while previous cases may still hold resume claims.
      const realCrypto = await vi.importActual<typeof import('node:crypto')>('node:crypto');
      vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(realCrypto.randomUUID);
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
      const overriddenId = attachment === 'id-config' || attachment === 'id-late' || attachment === 'id-fork';
      const forked = attachment === 'fork' || attachment === 'id-fork';
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
        ...(attachment === 'config' || attachment === 'id-config'
          ? { channels: config }
          : attachment === 'instance' || forked
            ? { channels }
            : {}),
      });
      const wrapperOptions = { agent: inner, ...(overriddenId ? { id: `durable-${testId}` } : {}) };
      const agent =
        engine === 'plain'
          ? inner
          : engine === 'durable'
            ? createDurableAgent(wrapperOptions)
            : overriddenId
              ? new EventedAgent(wrapperOptions)
              : createEventedAgent({ agent: inner });
      const memoryCallStacks: string[] = [];
      if (attachment === 'late-history') {
        const getMemory = agent.getMemory.bind(agent);
        vi.spyOn(agent, 'getMemory').mockImplementation((...args) => {
          memoryCallStacks.push(new Error().stack ?? '');
          return getMemory(...args);
        });
      }
      if (
        attachment === 'late' ||
        attachment === 'late-history' ||
        attachment === 'replacement' ||
        attachment === 'id-late' ||
        attachment === 'rebind'
      )
        agent.setChannels(channels);
      else channels = agent.getChannels()!;
      if (attachment === 'rebind') inner.setChannels(channels);
      const mastra = new Mastra({
        logger: false,
        storage,
        agents: { agent },
      });
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
        if (overriddenId) {
          const memoryStore = await storage.getStore('memory');
          await memoryStore!.saveThread({
            thread: {
              id: threadId,
              resourceId,
              title: 'Existing channel conversation',
              createdAt: new Date(),
              updatedAt: new Date(),
              metadata: {
                channel_platform: 'slack',
                channel_externalThreadId: 'C1:thread',
                channel_externalChannelId: 'C1:thread',
                channel_ownerId: inner.id,
                channel_subscribed: 'true',
              },
            },
          });
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
        if (forked && !decision) {
          agent.__fork().__updateInstructions('Transient fork instructions must not handle channel messages.');
        }
        if (overriddenId) {
          expect(channels.getWebhookRoutes().map(route => route.path)).toContain(
            `/api/agents/${inner.id}/channels/slack/webhook`,
          );
        }
        const message: Message = {
          id: 'inbound-1',
          threadId: 'C1:thread',
          text: overriddenId ? 'Continue our existing conversation' : '@TestBot hello',
          formatted: { type: 'root', children: [] },
          raw: {},
          attachments: [],
          author: { userId: 'U1', userName: 'alice', fullName: 'Alice', isBot: false, isMe: false },
          metadata: { dateSent: new Date(), edited: false },
        };
        if (attachment === 'late-history') {
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
        }
        const sdk = channels.sdk as unknown as {
          processMessage(adapter: unknown, threadId: string, message: Message): Promise<void>;
        };
        delivery = sdk.processMessage(adapter, message.threadId, message);
        await vi.waitFor(() => expect(subscription.activeRunId()).toBeTruthy(), { timeout: 5000 });
        const runId = subscription.activeRunId()!;
        expect(seenRunIds.has(runId), 'channel cases must not share durable run identities').toBe(false);
        seenRunIds.add(runId);
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
          if (engine !== 'plain') {
            const workflows = await storage.getStore('workflows');
            await vi.waitFor(
              async () => {
                const snapshot = await workflows!.getWorkflowRunById({
                  runId,
                  workflowName: DurableStepIds.AGENTIC_LOOP,
                });
                expect(snapshot?.snapshot.status).toBe('suspended');
              },
              { timeout: 5000 },
            );
          }
          expect(execute).not.toHaveBeenCalled();
          if (attachment === 'fork') {
            agent.__fork().__updateInstructions('Transient fork instructions must not handle channel messages.');
          }
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
        expect(JSON.stringify(llm.getRequests().map(request => request.body))).not.toContain(
          'Transient fork instructions',
        );
        expect(runIds.size).toBe(1);
        if (attachment === 'late-history') {
          const memoryStore = await storage.getStore('memory');
          const { messages } = await memoryStore!.listMessages({ threadId, perPage: 100 });
          const historyRows = messages.filter(row => row.id === `thread-history:${threadId}:prior-1`);
          expect(historyRows).toHaveLength(1);
          expect(historyRows[0]?.content.metadata?.signal?.attributes).toMatchObject({
            source: 'thread-history',
            messageId: 'prior-1',
          });
          expect(JSON.stringify(historyRows[0]?.content)).toContain('Earlier question from the platform thread');
          expect(
            memoryCallStacks.some(stack => stack.includes('persistThreadHistorySignals')),
            'first-mention history must read memory through the execution owner',
          ).toBe(true);
        }
        if (overriddenId) {
          const memoryStore = await storage.getStore('memory');
          const { threads } = await memoryStore!.listThreads({ filter: { resourceId } });
          expect(threads).toHaveLength(1);
          expect(threads[0]).toMatchObject({ id: threadId, metadata: { channel_ownerId: inner.id } });
        }
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

describe('reaction guidance reaches the model only with the reaction tool', () => {
  async function systemPromptSent(withReactionTools: boolean): Promise<string> {
    const channels = new AgentChannels({ adapters: { slack: createMockAdapter('slack') } });
    let prompt: unknown;
    const agent = new Agent({
      id: `reaction-guidance-${withReactionTools}`,
      name: 'reaction-guidance',
      instructions: 'You are a test agent',
      model: new MockLanguageModelV2({
        doStream: async options => {
          prompt = options.prompt;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 } },
            ]),
          };
        },
      }),
      tools: withReactionTools ? { ...(channels.getTools() as Record<string, any>) } : {},
    });
    agent.setChannels(channels);

    const requestContext = new RequestContext();
    requestContext.set('channel', { platform: 'slack', isDM: false });
    const result = await agent.stream('hey team', { requestContext });
    await result.consumeStream();

    return (prompt as Array<{ role: string; content: unknown }>)
      .filter(m => m.role === 'system')
      .map(m => String(m.content))
      .join('\n');
  }

  it('tells the model to react when add_reaction is mounted', async () => {
    expect(await systemPromptSent(true)).toContain('use the `add_reaction` tool');
  });

  it('never mentions add_reaction when the agent lacks it', async () => {
    const system = await systemPromptSent(false);
    expect(system).toContain('You are in a public channel or thread.');
    expect(system).not.toContain('add_reaction');
  });
});

describe('generative UI through the agent loop', () => {
  it('gives the model render_card and posts the card it calls with', async () => {
    const posted: any[] = [];
    const render = {
      platform: 'slack',
      generativeUI: true,
      chatThread: {
        post: async (card: unknown) => {
          posted.push(card);
          return { id: 'card-1' };
        },
      },
    };
    const toolNames: string[][] = [];
    let call = 0;
    const agent = new Agent({
      id: 'generative-ui-loop',
      name: 'generative-ui-loop',
      instructions: 'You are a test agent',
      inputProcessors: [new ChatChannelGenerativeUIProcessor()],
      model: new MockLanguageModelV2({
        doStream: async options => {
          toolNames.push((options.tools ?? []).map(t => t.name));
          const first = call++ === 0;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
              ...(first
                ? [
                    {
                      type: 'tool-call' as const,
                      toolCallId: 'call-1',
                      toolName: 'render_card',
                      input: JSON.stringify({
                        spec: {
                          root: 'card',
                          elements: {
                            card: { type: 'Card', props: { title: 'Deploy' }, children: ['f'] },
                            f: { type: 'Fields', children: ['env'] },
                            env: { type: 'Field', props: { label: 'Env', value: 'beta' } },
                          },
                        },
                      }),
                    },
                    {
                      type: 'finish' as const,
                      finishReason: 'tool-calls' as const,
                      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                    },
                  ]
                : [
                    {
                      type: 'finish' as const,
                      finishReason: 'stop' as const,
                      usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 },
                    },
                  ]),
            ]),
          };
        },
      }),
    });

    const requestContext = new RequestContext();
    requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, render);
    const result = await agent.stream('show the deploy', { requestContext, maxSteps: 3 });
    await result.consumeStream();

    expect(toolNames[0]).toContain('render_card');
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ type: 'card', title: 'Deploy' });
    expect((await result.toolResults)[0]?.payload.result).toEqual({ ok: true, messageId: 'card-1' });
  });

  it('lets the model condense an oversized chart from the returned issues and retry until it posts', async () => {
    const posted: any[] = [];
    const render = {
      platform: 'slack',
      generativeUI: true,
      chatThread: {
        post: async (card: unknown) => {
          posted.push(card);
          return { id: 'card-1' };
        },
      },
    };
    const days = Array.from({ length: 31 }, (_, i) => `Nov ${i + 1}`);
    const chartSpec = (categories: string[], seriesName: string) => ({
      spec: {
        root: 'card',
        elements: {
          card: { type: 'Card', props: { title: 'Velocity' }, children: ['chart'] },
          chart: {
            type: 'Chart',
            props: {
              title: 'Daily velocity',
              chart: { type: 'line', categories, series: [{ name: seriesName, values: categories.map((_, i) => i) }] },
            },
          },
        },
      },
    });
    const toolCall = (id: string, input: unknown) => [
      { type: 'tool-call' as const, toolCallId: id, toolName: 'render_card', input: JSON.stringify(input) },
      {
        type: 'finish' as const,
        finishReason: 'tool-calls' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      },
    ];
    // Reads the latest render_card result from the prompt, like a model would.
    const lastToolResult = (prompt: any[]) =>
      prompt
        .filter(m => m.role === 'tool')
        .flatMap(m => m.content)
        .filter((part: any) => part.type === 'tool-result')
        .at(-1)?.output?.value;

    const seenResults: any[] = [];
    const agent = new Agent({
      id: 'generative-ui-retry',
      name: 'generative-ui-retry',
      instructions: 'You are a test agent',
      inputProcessors: [new ChatChannelGenerativeUIProcessor()],
      model: new MockLanguageModelV2({
        doStream: async options => {
          const previous = lastToolResult(options.prompt as any[]);
          seenResults.push(previous);
          let parts;
          if (!previous) {
            // First try: the raw 31-day series with the full bot name.
            parts = toolCall('call-1', chartSpec(days, 'Factory (mastra-platform[bot])'));
          } else if (!previous.ok) {
            // Condense only what the issues point at.
            const issues: string = previous.issues.join('\n');
            const categories = issues.includes('at most 20 categories') ? days.slice(-20) : days;
            const name = issues.includes('longer than 20 characters') ? 'Factory' : 'Factory (mastra-platform[bot])';
            parts = toolCall(`call-${seenResults.length}`, chartSpec(categories, name));
          } else {
            parts = [
              {
                type: 'finish' as const,
                finishReason: 'stop' as const,
                usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 },
              },
            ];
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
              ...parts,
            ]),
          };
        },
      }),
    });

    const requestContext = new RequestContext();
    requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, render);
    const result = await agent.stream('chart daily velocity for November', { requestContext, maxSteps: 5 });
    await result.consumeStream();

    // Try, see issues, condense, try again, succeed, stop.
    expect(seenResults).toHaveLength(3);
    expect(seenResults[1]).toMatchObject({ ok: false });
    expect(seenResults[1].issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('at most 20 categories'),
        expect.stringContaining('"Factory (mastra-platform[bot])" longer than 20 characters'),
      ]),
    );
    expect(seenResults[2]).toEqual({ ok: true, messageId: 'card-1' });

    // Only the condensed card is posted, and it's still a native chart.
    expect(posted).toHaveLength(1);
    const chart = posted[0].children.find((child: any) => child.type === 'chart');
    expect(chart.chart.categories).toEqual(days.slice(-20));
    expect(chart.chart.series[0].name).toBe('Factory');
  });
});
