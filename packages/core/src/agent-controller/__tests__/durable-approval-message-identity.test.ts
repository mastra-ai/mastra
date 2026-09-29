import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { InMemoryServerCache } from '../../cache';
import { EventEmitterPubSub } from '../../events';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

vi.setConfig({ testTimeout: 30_000 });

describe('public approval completion keeps one answer identity', () => {
  it.each([
    { yolo: false, durable: false, rounds: 1, siblings: 1, chunkDelay: 0 },
    { yolo: true, durable: false, rounds: 1, siblings: 1, chunkDelay: 0 },
    { yolo: false, durable: true, rounds: 1, siblings: 1, chunkDelay: 0 },
    { yolo: true, durable: true, rounds: 1, siblings: 1, chunkDelay: 0 },
    { yolo: false, durable: true, rounds: 2, siblings: 1, chunkDelay: 0 },
    { yolo: false, durable: true, rounds: 1, siblings: 2, chunkDelay: 0 },
    { yolo: false, durable: true, rounds: 2, siblings: 2, chunkDelay: 5 },
  ])(
    'keeps one answer: yolo=$yolo durable=$durable rounds=$rounds siblings=$siblings chunkDelay=$chunkDelay',
    async ({ yolo, durable, rounds, siblings, chunkDelay }) => {
      let modelCalls = 0;
      let toolCalls = 0;
      const model = new MastraLanguageModelV2Mock({
        doStream: async () => {
          const call = ++modelCalls;
          return {
            stream: new ReadableStream({
              start(stream) {
                stream.enqueue({ type: 'stream-start', warnings: [] });
                stream.enqueue({
                  type: 'response-metadata',
                  id: `provider-${call}`,
                  modelId: 'mock',
                  timestamp: new Date(0),
                });
                if (call <= rounds) {
                  for (let sibling = 0; sibling < siblings; sibling++) {
                    stream.enqueue({
                      type: 'tool-call',
                      toolCallId: `page-read-${call}-${sibling}`,
                      toolName: 'read_page',
                      input: '{}',
                      providerExecuted: false,
                    });
                  }
                } else {
                  stream.enqueue({ type: 'text-start', id: 'answer' });
                  stream.enqueue({ type: 'text-delta', id: 'answer', delta: 'Example Domain' });
                  stream.enqueue({ type: 'text-end', id: 'answer' });
                }
                stream.enqueue({
                  type: 'finish',
                  finishReason: call <= rounds ? 'tool-calls' : 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                stream.close();
              },
            }),
          };
        },
      });
      const storage = new InMemoryStore();
      const baseAgent = new Agent({
        id: 'identity-agent',
        name: 'Identity agent',
        instructions: 'Read one page.',
        model,
        outputProcessors: [
          {
            id: 'usage-metadata',
            processOutputStep: async ({ messageList }) => messageList,
            processOutputStream: async ({ part }) => {
              if (chunkDelay) await new Promise(resolve => setTimeout(resolve, chunkDelay));
              return part;
            },
            processOutputResult: async ({ messages }) => {
              await new Promise(resolve => setTimeout(resolve, 30));
              return messages.map(message => ({
                ...message,
                content: { ...message.content, metadata: { ...message.content.metadata, fixtureUsage: true } },
              }));
            },
          },
        ],
        tools: {
          read_page: createTool({
            id: 'read_page',
            description: 'Read a fixture page.',
            inputSchema: z.object({}),
            execute: async () => {
              toolCalls++;
              return { title: 'Example Domain' };
            },
          }),
        },
      });
      const cache = new InMemoryServerCache();
      const pubsub = new EventEmitterPubSub();
      const agent = durable ? createDurableAgent({ agent: baseAgent, cache, pubsub }) : baseAgent;
      const mastra = new Mastra({ agents: { agent: agent as any }, storage, cache, pubsub, logger: false });
      const controller = new AgentController({
        id: 'identity-controller',
        agent: mastra.getAgent('agent'),
        pubsub,
        workspace: createMockWorkspace(),
        storage,
        initialState: { yolo } as any,
        modes: [{ id: 'default', default: true }],
      });
      await controller.init();
      const session = await controller.createSession({
        resourceId: 'identity-user',
        scope: 'thread:identity-thread',
        threadId: 'identity-thread',
      });
      const events: AgentControllerEvent[] = [];
      const messageText = new Map<string, string>();
      const endedMessages: string[] = [];
      const approved = new Set<string>();
      session.subscribe(event => {
        events.push(event);
        if (event.type === 'message_start') messageText.set(event.message.id, '');
        if (event.type === 'message_update' && event.event.type === 'text-delta') {
          messageText.set(event.id, `${messageText.get(event.id) ?? ''}${event.event.delta}`);
        }
        if (event.type === 'message_end') endedMessages.push(event.id);
        if (event.type === 'tool_approval_required' && !approved.has(event.toolCallId)) {
          approved.add(event.toolCallId);
          queueMicrotask(() => {
            session.respondToToolApproval({ decision: 'approve', toolCallId: event.toolCallId });
          });
        }
      });
      await session.sendMessage({ content: 'Read the fixture page.' });
      await vi.waitFor(
        () => {
          expect(modelCalls).toBe(rounds + 1);
          expect(session.run.isRunning()).toBe(false);
        },
        { timeout: 20_000 },
      );
      await new Promise(resolve => setTimeout(resolve, 300));

      const answerIds = [...messageText].filter(([, text]) => text === 'Example Domain').map(([id]) => id);
      const expectedUsage = { promptTokens: rounds + 1, completionTokens: rounds + 1, totalTokens: (rounds + 1) * 2 };
      const memory = await storage.getStore('memory');
      const thread = await memory?.getThreadById({ threadId: 'identity-thread' });

      expect(modelCalls).toBe(rounds + 1);
      expect(toolCalls).toBe(rounds * siblings);
      expect(events.filter(event => event.type === 'agent_start')).toHaveLength(1);
      expect(events.filter(event => event.type === 'agent_end')).toHaveLength(1);
      expect(events.filter(event => event.type === 'tool_end' && !event.denied)).toHaveLength(rounds * siblings);
      expect(events.filter(event => event.type === 'usage_update')).toHaveLength(rounds + 1);
      expect(answerIds).toHaveLength(1);
      expect(endedMessages.filter(id => id === answerIds[0])).toHaveLength(1);
      expect(session.getTokenUsage()).toMatchObject(expectedUsage);
      expect(thread?.metadata?.tokenUsage).toMatchObject(expectedUsage);
    },
  );
});
