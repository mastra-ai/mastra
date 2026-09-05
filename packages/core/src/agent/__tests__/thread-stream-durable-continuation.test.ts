import { describe, expect, it, vi } from 'vitest';

import { EventEmitterPubSub } from '../../events';
import { RequestContext } from '../../request-context';
import type { Agent } from '../agent';
import { createDurableAgentStream, emitChunkEvent, emitFinishEvent } from '../durable/stream-adapter';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

function setup() {
  const runtime = new AgentThreadStreamRuntime();
  const pubsub = new EventEmitterPubSub();
  const publish = vi.spyOn(pubsub, 'publish');
  const agent = { id: 'continuation-agent' } as Agent<any, any, any, any>;
  const options = { memory: { thread: 'continuation-thread', resource: 'continuation-user' } };
  const runId = crypto.randomUUID();
  const makeStream = () =>
    createDurableAgentStream({
      pubsub,
      runId,
      messageId: crypto.randomUUID(),
      model: { modelId: 'mock', provider: 'mock', version: 'v3' },
    });
  const chunk = (type: string, payload: Record<string, unknown>) =>
    emitChunkEvent(pubsub, runId, { type, payload, runId, from: 'AGENT' } as any);
  const finish = () =>
    emitFinishEvent(pubsub, runId, {
      output: { text: 'answer', steps: [] },
      stepResult: { reason: 'stop' },
    } as any);
  const registrations = () => publish.mock.calls.filter(([, event]) => event.type === 'run-registered');
  return { runtime, pubsub, agent, options, runId, makeStream, chunk, finish, registrations };
}

describe('durable thread continuation', () => {
  it.each([false, true])('broadcasts one answer and keeps the prefix with delayed reader=%s', async delayed => {
    const h = setup();
    const initialContext = new RequestContext();
    const resumedContext = new RequestContext();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, { ...h.options, requestContext: initialContext }, h.pubsub, {
      canContinueAcrossSuspension: first.isOpen,
    });
    const subscription = await h.runtime.subscribeToThread(
      h.agent,
      {
        threadId: h.options.memory.thread,
        resourceId: h.options.memory.resource,
      },
      h.pubsub,
    );
    const parts: any[] = [];
    const read = async () => {
      for await (const part of subscription.stream) parts.push(part);
    };
    let reading = delayed ? undefined : read();
    await h.chunk('text-delta', { text: 'prefix' });
    await h.chunk('tool-call-approval', { toolCallId: 'call-1', toolName: 'read_page', args: {} });
    await vi.waitFor(() => expect(first.output.status).toBe('suspended'));
    if (!delayed) {
      await vi.waitFor(() => expect(parts.some(part => part.type === 'tool-call-approval')).toBe(true));
      expect(subscription.__getCurrentRunRequestContext()).toBe(initialContext);
    }
    const resumed = h.makeStream();
    await resumed.ready;
    await h.runtime.registerRun(
      h.agent,
      resumed.output,
      {
        ...h.options,
        requestContext: resumedContext,
        toolCallId: 'call-1',
      } as any,
      h.pubsub,
      { canContinueAcrossSuspension: resumed.isOpen },
    );
    expect(h.registrations()).toHaveLength(1);
    if (!delayed) expect(subscription.__getCurrentRunRequestContext()).toBe(resumedContext);

    // A resumed segment is running even while the continuous output's last
    // status remains suspended. Same-agent work must still wait its turn.
    let contenderStarted = false;
    const contender = h.runtime
      .waitForCrossAgentThreadRun(h.agent, { ...h.options, runId: 'next-run' }, h.pubsub)
      .then(() => {
        contenderStarted = true;
      });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(contenderStarted).toBe(false);
    await h.chunk('text-delta', { text: 'answer' });
    await h.finish();
    // No caller reads resumed.fullStream; registration must drain it itself.
    await resumed.output._waitUntilFinished();
    reading ??= read();
    await vi.waitFor(() => expect(parts.some(part => part.type === 'finish')).toBe(true));
    expect(parts.filter(part => part.type === 'text-delta').map(part => part.payload.text)).toEqual([
      'prefix',
      'answer',
    ]);
    await contender;
    subscription.unsubscribe();
    await reading;
    first.cleanup();
    resumed.cleanup();
    await h.pubsub.close();
  });

  it('registers a replacement after the original adapter was cleaned up', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      canContinueAcrossSuspension: first.isOpen,
    });
    await h.chunk('tool-call-approval', { toolCallId: 'call-1', toolName: 'read_page', args: {} });
    await vi.waitFor(() => expect(first.output.status).toBe('suspended'));
    first.cleanup();
    expect(first.isOpen()).toBe(false);
    const resumed = h.makeStream();
    await resumed.ready;
    await h.runtime.registerRun(h.agent, resumed.output, h.options, h.pubsub, {
      canContinueAcrossSuspension: resumed.isOpen,
    });
    expect(h.registrations()).toHaveLength(2);
    const subscription = await h.runtime.subscribeToThread(
      h.agent,
      {
        threadId: h.options.memory.thread,
        resourceId: h.options.memory.resource,
      },
      h.pubsub,
    );
    const parts: any[] = [];
    const reading = (async () => {
      for await (const part of subscription.stream) parts.push(part);
    })();
    await h.chunk('text-delta', { text: 'answer' });
    await h.finish();
    await vi.waitFor(() => expect(parts.some(part => part.type === 'finish')).toBe(true));
    expect(parts.filter(part => part.type === 'text-delta')).toHaveLength(1);
    subscription.unsubscribe();
    await reading;
    resumed.cleanup();
    await h.pubsub.close();
  });

  it('keeps strict recovery ownership validation even for a live same-run stream', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      canContinueAcrossSuspension: first.isOpen,
    });
    const recovered = h.makeStream();
    await recovered.ready;
    await expect(
      h.runtime.registerRun(h.agent, recovered.output, h.options, h.pubsub, {
        strict: true,
        canContinueAcrossSuspension: recovered.isOpen,
        validate: () => {
          throw new Error('Recovery ownership lost');
        },
      }),
    ).rejects.toThrow('Recovery ownership lost');
    expect(h.registrations()).toHaveLength(1);
    await h.finish();
    await first.output._waitUntilFinished();
    first.cleanup();
    recovered.cleanup();
    await h.pubsub.close();
  });
});
