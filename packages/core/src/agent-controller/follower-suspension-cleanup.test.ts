/**
 * A Session that follows a thread mirrors tool suspensions from runs started on
 * another instance (shared pubsub + storage). When that run is resumed there and
 * completes, the follower must drop its mirror instead of keeping a stale call.
 */
import { MockLanguageModelV4, convertArrayToReadableStream } from '@internal/ai-v7/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../agent/thread-stream-runtime';
import { EventEmitterPubSub } from '../events/event-emitter';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage/mock';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const resourceId = 'follow-user';
const threadId = 'follow-thread';

function model() {
  return new MockLanguageModelV4({
    doStream: async ({ prompt }) => {
      const answered = JSON.stringify(prompt).includes('"type":"tool-result"');
      const parts = answered
        ? [
            { type: 'text-start' as const, id: 't' },
            { type: 'text-delta' as const, id: 't', delta: 'done' },
            { type: 'text-end' as const, id: 't' },
            { type: 'finish' as const, finishReason: 'stop' as const, usage },
          ]
        : [
            { type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'ask', input: '{"q":"x"}' },
            { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
          ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: 'r', modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ]),
      };
    },
  });
}

async function setup() {
  const storage = new InMemoryStore();
  const memoryStorage = new InMemoryStore();
  const pubsub = new EventEmitterPubSub();

  const boot = async (instance: string) => {
    const ask = createTool({
      id: 'ask',
      description: 'ask the user',
      inputSchema: z.object({ q: z.string() }),
      suspendSchema: z.object({ question: z.string() }),
      resumeSchema: z.object({ answer: z.string() }),
      execute: async (_input, context) => {
        const resumeData = context?.agent?.resumeData as { answer: string } | undefined;
        if (!resumeData) return context?.agent?.suspend?.({ question: 'what?' });
        return { answer: resumeData.answer };
      },
    });
    const agent = new Agent({
      id: 'follow-agent',
      name: 'follow-agent',
      instructions: 'test',
      model: model(),
      tools: { ask },
    });
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'follow-controller',
      storage,
      pubsub,
      memory: new MockMemory({ storage: memoryStorage }),
      initialState: { yolo: true } as any,
      modes: [{ id: 'default', name: 'Default', default: true, agent, defaultModelId: 'mock-model' }],
    });
    await controller.init();
    const session = await controller.createSession({
      id: `session-${instance}`,
      ownerId: 'owner',
      resourceId,
      threadId,
    });
    await controller.getMastra()?.startWorkers();
    const events: AgentControllerEvent[] = [];
    session.subscribe(e => events.push(e));
    return { session, events };
  };

  const { session: a, events: aEvents } = await boot('a');
  const { session: b, events: bEvents } = await boot('b');
  return { a, b, aEvents, bEvents };
}

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
});

describe('follower Session suspension cleanup', () => {
  it('drops the mirrored suspension once the run is resumed elsewhere and completes', async () => {
    const { a, b, aEvents, bEvents } = await setup();

    void a.sendMessage({ content: 'use the tool' }).catch(() => {});
    await vi.waitFor(() => expect(b.suspensions.hasPending()).toBe(true), { timeout: 10_000 });
    await vi.waitFor(() => expect(a.suspensions.hasPending()).toBe(true), { timeout: 10_000 });

    await a.respondToToolSuspension({ toolCallId: 'call-1', resumeData: { answer: 'yes' } });

    await vi.waitFor(
      () => expect(bEvents.some(e => e.type === 'agent_end' && (e as any).reason === 'complete')).toBe(true),
      { timeout: 10_000 },
    );
    await vi.waitFor(() =>
      expect(aEvents.some(e => e.type === 'agent_end' && (e as any).reason === 'complete')).toBe(true),
    );

    expect(b.suspensions.hasPending()).toBe(false);
    expect(b.suspensions.get({ toolCallId: 'call-1' })).toBeUndefined();
    expect(b.displayState.get().pendingSuspensions.size).toBe(0);
    expect(bEvents.some(e => e.type === 'tool_suspension_cancelled')).toBe(false);

    const before = bEvents.length;
    await b.abortRun();
    expect(bEvents.slice(before).some(e => e.type === 'tool_suspension_cancelled')).toBe(false);
  }, 30_000);

  it('keeps the mirrored suspension while the run stays suspended', async () => {
    const { a, b, bEvents } = await setup();

    void a.sendMessage({ content: 'use the tool' }).catch(() => {});
    await vi.waitFor(
      () => expect(bEvents.some(e => e.type === 'agent_end' && (e as any).reason === 'suspended')).toBe(true),
      { timeout: 10_000 },
    );

    expect(b.suspensions.hasPending()).toBe(true);
    expect(b.displayState.get().pendingSuspensions.size).toBe(1);
  }, 30_000);
});
