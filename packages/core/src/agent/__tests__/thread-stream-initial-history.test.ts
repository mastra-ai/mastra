/**
 * `subscribeToThread({ withInitialHistory })` (#21231): the subscription emits
 * one `thread-history` chunk from storage, then only the retained parts that
 * history does not already cover, then live parts.
 */
import { describe, expect, it } from 'vitest';

import type { Agent } from '../agent';
import type { MastraDBMessage } from '../message-list/types';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import { createHarness, nextTicks, setupRuntime } from './thread-stream-test-utils';

const harness = createHarness('history');
const { runId, streamId, threadId, resourceId, topic } = harness;

function assistantMessage(id: string, createdAt: Date, metadata?: Record<string, unknown>): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    threadId,
    resourceId,
    createdAt,
    content: { format: 2, parts: [{ type: 'text', text: 'saved answer' }], ...(metadata ? { metadata } : {}) },
  } as MastraDBMessage;
}

function setup(stored: () => MastraDBMessage[]) {
  const ctx = setupRuntime(harness);
  ctx.pubsub.retain = true;
  const recalls: unknown[] = [];
  const agent = {
    id: harness.agent.id,
    getMemory: async () => ({
      getThreadById: async ({ threadId }: { threadId: string }) => ({ id: threadId }),
      recall: async (args: unknown) => {
        recalls.push(args);
        return { messages: [...stored()].reverse(), hasMore: false };
      },
    }),
  } as unknown as Agent<any, any, any, any>;
  const emitRun = (id: string, stream: string) => ({
    part: (part: unknown) => ctx.emit({ type: 'stream-part', runId: id, streamId: stream, sourceId: 'origin', part }),
    registered: () => ctx.emit({ type: 'run-registered', runId: id, streamId: stream, streamSeq: 1 }),
    completed: () => ctx.emit({ type: 'run-completed', runId: id, streamId: stream, persisted: true }),
  });
  const subscribe = async (
    withInitialHistory: boolean | { perPage?: number } = true,
    runtime: AgentThreadStreamRuntime = ctx.runtime,
  ) => {
    const subscription = await runtime.subscribeToThread(
      agent,
      { threadId, resourceId, withInitialHistory },
      ctx.pubsub,
    );
    const collected: any[] = [];
    const consumed = (async () => {
      for await (const part of subscription.stream) collected.push(part);
    })();
    return { subscription, collected, consumed };
  };
  return { ...ctx, recalls, emitRun, subscribe };
}

describe('subscribeToThread withInitialHistory', () => {
  it('emits history and drops every part of completed runs already stored', async () => {
    let stored: MastraDBMessage[] = [];
    const { emitRun, subscribe } = setup(() => stored);
    for (const [i, message] of ['m1', 'm2'].entries()) {
      const run = emitRun(`run-${i}`, `stream-${i}`);
      await run.registered();
      await run.part({ type: 'start', payload: { messageId: message } });
      await run.part({ type: 'text-delta', payload: { text: 'saved answer' } });
      await run.part({ type: 'tool-call-approval', payload: { toolCallId: `tc-${i}`, toolName: 't', args: {} } });
      await run.part({ type: 'finish', payload: {} });
      await run.completed();
    }
    stored = [assistantMessage('m1', new Date()), assistantMessage('m2', new Date())];

    const { subscription, collected, consumed } = await subscribe();
    await nextTicks(10);

    expect(collected.map(p => p.type)).toEqual(['thread-history']);
    expect(collected[0].payload.messages.map((m: MastraDBMessage) => m.id)).toEqual(['m1', 'm2']);
    subscription.unsubscribe();
    await consumed;
  });

  it('keeps the pending approval of a suspended run', async () => {
    let stored: MastraDBMessage[] = [];
    const { emitRun, subscribe } = setup(() => stored);
    const run = emitRun(runId, streamId);
    await run.registered();
    await run.part({ type: 'start', payload: { messageId: 'm1' } });
    await run.part({ type: 'tool-call-approval', payload: { toolCallId: 'tc-1', toolName: 't', args: {} } });
    await run.part({ type: 'finish', payload: {} });
    await run.completed();
    stored = [
      assistantMessage('m1', new Date(), {
        pendingToolApprovals: { 'tc-1': { toolCallId: 'tc-1', toolName: 't', args: {} } },
      }),
    ];

    const { subscription, collected, consumed } = await subscribe();
    await nextTicks(10);

    expect(collected.map(p => p.type)).toEqual(['thread-history', 'tool-call-approval']);
    subscription.unsubscribe();
    await consumed;
  });

  it('joins mid-run: drops saved parts, streams unsaved and live parts once', async () => {
    let stored: MastraDBMessage[] = [];
    const { emitRun, subscribe, pubsub } = setup(() => stored);
    pubsub.owners.set([resourceId, threadId].join('\u0000'), runId);
    const run = emitRun(runId, streamId);
    await run.registered();
    await run.part({ type: 'start', payload: { messageId: 'm1' } });
    await run.part({ type: 'text-delta', payload: { text: 'saved' } });
    await new Promise(resolve => setTimeout(resolve, 5));
    stored = [assistantMessage('m1', new Date())];
    await new Promise(resolve => setTimeout(resolve, 5));
    await run.part({ type: 'text-delta', payload: { text: ' unsaved' } });

    const { subscription, collected, consumed } = await subscribe();
    await run.part({ type: 'text-delta', payload: { text: ' live' } });
    await run.part({ type: 'finish', payload: {} });
    await run.completed();
    await nextTicks(10);

    const texts = collected.filter(p => p.type === 'text-delta').map(p => p.payload.text);
    expect(collected[0].type).toBe('thread-history');
    expect(texts).toEqual([' unsaved', ' live']);
    expect(collected.filter(p => p.type === 'finish')).toHaveLength(1);
    subscription.unsubscribe();
    await consumed;
  });

  it('drops a tool result already stored but keeps a newer state change', async () => {
    let stored: MastraDBMessage[] = [];
    const { emitRun, subscribe, pubsub } = setup(() => stored);
    pubsub.owners.set([resourceId, threadId].join('\u0000'), runId);
    const run = emitRun(runId, streamId);
    await run.registered();
    await run.part({ type: 'start', payload: { messageId: 'm1' } });
    await run.part({ type: 'tool-call', payload: { toolCallId: 'tc-1', toolName: 't', args: {} } });
    stored = [assistantMessage('m1', new Date(Date.now() + 1_000))];

    const { subscription, collected, consumed } = await subscribe();
    await run.part({
      type: 'tool-result',
      payload: { toolCallId: 'tc-1', toolName: 't', result: 1, updatedAt: Date.now() + 2_000 },
    });
    await nextTicks(10);

    // The run is still going, so the joiner also gets its `start`.
    expect(collected.map(p => p.type)).toEqual(['thread-history', 'start', 'tool-result']);
    subscription.unsubscribe();
    await consumed;
  });

  it('passes perPage through and leaves subscribers without the option unchanged', async () => {
    const { emitRun, subscribe, recalls, pubsub } = setup(() => []);
    pubsub.owners.set([resourceId, threadId].join('\u0000'), runId);
    const withHistory = await subscribe({ perPage: 5 });
    expect(recalls).toEqual([expect.objectContaining({ perPage: 5 })]);

    const plain = await subscribe(false);
    const run = emitRun(runId, streamId);
    await run.registered();
    await run.part({ type: 'start', payload: { messageId: 'm1' } });
    await nextTicks(10);

    expect(recalls).toHaveLength(1);
    expect(plain.collected.map(p => p.type)).toEqual(['start']);
    expect(withHistory.collected.map(p => p.type)).toEqual(['thread-history', 'start']);
    expect(topic).toContain(threadId);
    for (const s of [withHistory, plain]) {
      s.subscription.unsubscribe();
      await s.consumed;
    }
  });

  it('reconnect gap: a new subscription gets parts published while disconnected, once', async () => {
    let stored: MastraDBMessage[] = [];
    const { emitRun, subscribe, pubsub } = setup(() => stored);
    pubsub.owners.set([resourceId, threadId].join('\u0000'), runId);
    const run = emitRun(runId, streamId);
    await run.registered();
    await run.part({ type: 'start', payload: { messageId: 'm1' } });

    const first = await subscribe();
    await run.part({ type: 'text-delta', payload: { text: 'a' } });
    await nextTicks(10);
    first.subscription.unsubscribe();
    await first.consumed;

    await new Promise(resolve => setTimeout(resolve, 5));
    stored = [assistantMessage('m1', new Date())];
    await new Promise(resolve => setTimeout(resolve, 5));
    await run.part({ type: 'text-delta', payload: { text: 'b' } });

    const second = await subscribe();
    await run.part({ type: 'text-delta', payload: { text: 'c' } });
    await run.part({ type: 'finish', payload: {} });
    await run.completed();
    await nextTicks(10);

    const texts = second.collected.filter(p => p.type === 'text-delta').map(p => p.payload.text);
    expect(second.collected[0].type).toBe('thread-history');
    expect(texts).toEqual(['b', 'c']);
    expect(second.collected.filter(p => p.type === 'finish')).toHaveLength(1);
    second.subscription.unsubscribe();
    await second.consumed;
  });

  it('multi-instance: runtimes sharing one retained pubsub see the same history-filtered stream', async () => {
    let stored: MastraDBMessage[] = [];
    const { emitRun, subscribe, pubsub } = setup(() => stored);
    pubsub.owners.set([resourceId, threadId].join('\u0000'), runId);
    const done = emitRun('run-done', 'stream-done');
    await done.registered();
    await done.part({ type: 'start', payload: { messageId: 'm0' } });
    await done.part({ type: 'text-delta', payload: { text: 'old' } });
    await done.part({ type: 'finish', payload: {} });
    await done.completed();
    stored = [assistantMessage('m0', new Date())];

    const run = emitRun(runId, streamId);
    await run.registered();
    await run.part({ type: 'start', payload: { messageId: 'm1' } });
    const a = await subscribe(true);
    const b = await subscribe(true, new AgentThreadStreamRuntime());
    await run.part({ type: 'text-delta', payload: { text: 'live' } });
    await run.part({ type: 'finish', payload: {} });
    await run.completed();
    await nextTicks(10);

    for (const { collected } of [a, b]) {
      expect(collected[0].type).toBe('thread-history');
      expect(collected.filter(p => p.type === 'text-delta').map(p => p.payload.text)).toEqual(['live']);
      expect(collected.filter(p => p.type === 'finish')).toHaveLength(1);
    }
    expect(a.collected.map(p => p.type)).toEqual(b.collected.map(p => p.type));
    for (const s of [a, b]) {
      s.subscription.unsubscribe();
      await s.consumed;
    }
  });
});
