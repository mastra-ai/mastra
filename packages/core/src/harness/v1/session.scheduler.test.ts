/**
 * Harness v1 — durable queue scheduler tests.
 *
 * Covers the `_scheduleNextQueueHead(...)` step that runs once per
 * drain iteration:
 *   - priority drain: highest-priority survivor is rotated to position
 *     0 before the drain consumes it;
 *   - deadline expiry: items whose `deadline` passed before drain are
 *     dropped, emit `queue_item_expired`, and have their receipt
 *     marked `failed`;
 *   - FIFO tie-break: same-priority items stay in `enqueuedAt` order.
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { buildFakeOutput } from './__test-utils__/fake-output';

import type { HarnessEvent } from './events';
import { Harness } from './harness';

class FakeAgent extends Agent<any, any, any> {
  chunks: any[] = [];
  fullOutput: any = {
    text: 'ok',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    finishReason: 'stop',
    object: undefined,
    steps: [],
    warnings: [],
    providerMetadata: undefined,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: { id: 'r', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
    totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId: 'fake-run',
    suspendPayload: undefined,
    messages: [],
    rememberedMessages: [],
  };
  constructor(name: string) {
    super({ id: name, name, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }
  async stream(_messages: any, options?: any): Promise<any> {
    const out = buildFakeOutput({
      runId: options?.runId ?? this.fullOutput.runId,
      fullOutput: this.fullOutput,
      chunks: this.chunks,
    });
    this._internalRegisterStreamRun(out, (options ?? {}) as any);
    return out;
  }
  async generate(_messages: any, _options?: any): Promise<any> {
    return this.fullOutput;
  }
  async resumeStream(_resumeData: any, options?: any): Promise<any> {
    return this.stream(undefined, options);
  }
}

async function setup() {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage },
  });
  const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
  return { harness, session, storage };
}

describe('_scheduleNextQueueHead — priority rotation', () => {
  it('rotates the highest-priority survivor to position 0', async () => {
    const { session } = await setup();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'q-low-1', admissionId: 'a1', enqueuedAt: 1, content: 'low-1', attachments: [], priority: 0 },
        { id: 'q-high', admissionId: 'a2', enqueuedAt: 2, content: 'high', attachments: [], priority: 10 },
        { id: 'q-low-2', admissionId: 'a3', enqueuedAt: 3, content: 'low-2', attachments: [], priority: 0 },
      ],
    }));
    await (session as any)._scheduleNextQueueHead();
    const queue = session.getRecord().pendingQueue ?? [];
    expect(queue.map(i => i.id)).toEqual(['q-high', 'q-low-1', 'q-low-2']);
  });

  it('keeps FIFO order when priorities tie', async () => {
    const { session } = await setup();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'q-1', admissionId: 'a1', enqueuedAt: 1, content: 'a', attachments: [], priority: 5 },
        { id: 'q-2', admissionId: 'a2', enqueuedAt: 2, content: 'b', attachments: [], priority: 5 },
        { id: 'q-3', admissionId: 'a3', enqueuedAt: 3, content: 'c', attachments: [], priority: 5 },
      ],
    }));
    await (session as any)._scheduleNextQueueHead();
    const queue = session.getRecord().pendingQueue ?? [];
    expect(queue.map(i => i.id)).toEqual(['q-1', 'q-2', 'q-3']);
  });

  it('treats absent priority as 0', async () => {
    const { session } = await setup();
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'q-default', admissionId: 'a1', enqueuedAt: 1, content: 'd', attachments: [] },
        { id: 'q-neg', admissionId: 'a2', enqueuedAt: 2, content: 'n', attachments: [], priority: -5 },
      ],
    }));
    await (session as any)._scheduleNextQueueHead();
    const queue = session.getRecord().pendingQueue ?? [];
    expect(queue.map(i => i.id)).toEqual(['q-default', 'q-neg']);
  });
});

describe('_scheduleNextQueueHead — deadline expiry', () => {
  it('drops expired items + emits queue_item_expired + marks receipt failed', async () => {
    const { session } = await setup();
    const events: HarnessEvent[] = [];
    session.subscribe(e => events.push(e));
    const past = Date.now() - 1000;
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'q-expired', admissionId: 'a1', enqueuedAt: 1, content: 'x', attachments: [], deadline: past },
        { id: 'q-alive', admissionId: 'a2', enqueuedAt: 2, content: 'a', attachments: [] },
      ],
      queueAdmissionReceipts: {
        'q-expired': {
          admissionId: 'a1',
          admissionHash: 'h1',
          queuedItemId: 'q-expired',
          status: 'queued',
          attempts: 0,
          enqueuedAt: 1,
          updatedAt: 1,
        },
      },
    }));
    await (session as any)._scheduleNextQueueHead();
    const queue = session.getRecord().pendingQueue ?? [];
    expect(queue.map(i => i.id)).toEqual(['q-alive']);
    const expiredEvent = events.find(e => e.type === 'queue_item_expired') as any;
    expect(expiredEvent).toBeDefined();
    expect(expiredEvent.queuedItemId).toBe('q-expired');
    expect(expiredEvent.deadline).toBe(past);
    const receipt = (session.getRecord().queueAdmissionReceipts ?? {})['q-expired'];
    expect(receipt?.status).toBe('failed');
  });

  it('keeps items whose deadline is in the future', async () => {
    const { session } = await setup();
    const future = Date.now() + 60_000;
    await (session as any)._flushUpdate((prev: any) => ({
      ...prev,
      pendingQueue: [
        { id: 'q-future', admissionId: 'a1', enqueuedAt: 1, content: 'f', attachments: [], deadline: future },
      ],
    }));
    await (session as any)._scheduleNextQueueHead();
    expect((session.getRecord().pendingQueue ?? []).map(i => i.id)).toEqual(['q-future']);
  });

  it('no-op when the queue is empty', async () => {
    const { session } = await setup();
    const before = session.getRecord().pendingQueue;
    await (session as any)._scheduleNextQueueHead();
    expect(session.getRecord().pendingQueue).toEqual(before);
  });
});
