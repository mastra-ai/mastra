/**
 * A run stopped because another run took its thread lease ends with `agent_end`
 * saying so, so a host can tell the user why the run stopped instead of showing a
 * bare "aborted".
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '300';
});

import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../agent/thread-stream-runtime';
import { EventEmitterPubSub } from '../events/event-emitter';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage/mock';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

vi.setConfig({ testTimeout: 30_000 });

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const resourceId = 'lease-reason-user';
const threadId = 'lease-reason-thread';

/** Another process takes every thread lease once `takenOver` is set. */
class TakeoverPubSub extends EventEmitterPubSub {
  takenOver = false;
  override async renewLease(key: string, owner: string, ttlMs: number) {
    if (this.takenOver) return false;
    return super.renewLease(key, owner, ttlMs);
  }
  override async acquireLease(key: string, owner: string, ttlMs: number) {
    if (this.takenOver) return { acquired: false, owner: 'another-process-run' };
    return super.acquireLease(key, owner, ttlMs);
  }
  override async getLeaseOwner(key: string) {
    if (this.takenOver) return 'another-process-run';
    return super.getLeaseOwner(key);
  }
}

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
});

describe('a run that loses its thread lease', () => {
  it('ends with agent_end saying another run holds the thread lease', async () => {
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        calls++;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start' as const, warnings: [] },
            { type: 'response-metadata' as const, id: `r${calls}`, modelId: 'mock', timestamp: new Date(0) },
            { type: 'tool-call' as const, toolCallId: `call-${calls}`, toolName: 'tick', input: '{}' },
            { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
          ]),
        };
      },
    });
    let ticks = 0;
    const tick = createTool({
      id: 'tick',
      description: 'Tick once',
      inputSchema: z.object({}),
      execute: async () => {
        ticks++;
        await new Promise(resolve => setTimeout(resolve, 20));
        return 'ticked';
      },
    });
    const agent = new Agent({
      id: 'lease-reason-agent',
      name: 'lease-reason-agent',
      instructions: 'tick',
      model,
      tools: { tick },
    });
    const pubsub = new TakeoverPubSub();
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'lease-reason-controller',
      storage: new InMemoryStore(),
      pubsub,
      memory: new MockMemory({ storage: new InMemoryStore() }),
      initialState: { yolo: true } as any,
      modes: [{ id: 'default', name: 'Default', default: true, agent, defaultModelId: 'mock-model' }],
    });
    await controller.init();
    const session = await controller.createSession({
      id: 'lease-reason-session',
      ownerId: 'owner',
      resourceId,
      threadId,
    });
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    void session.sendMessage({ content: 'keep ticking' }).catch(() => {});
    await vi.waitFor(() => expect(ticks).toBeGreaterThanOrEqual(2), { timeout: 10_000 });
    pubsub.takenOver = true;

    await vi.waitFor(() => expect(events.some(event => event.type === 'agent_end')).toBe(true), { timeout: 10_000 });
    expect(events.filter(event => event.type === 'agent_end')).toEqual([
      { type: 'agent_end', reason: 'aborted', abortReason: 'thread-lease-lost' },
    ]);
  });
});
