import { describe, expect, it, vi } from 'vitest';

import { EventEmitterPubSub } from '../../events';
import { RequestContext } from '../../request-context';
import type { Agent } from '../agent';
import { createDurableAgentStream, emitChunkEvent, emitErrorEvent, emitFinishEvent } from '../durable/stream-adapter';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

function setup() {
  const runtime = new AgentThreadStreamRuntime();
  const pubsub = new EventEmitterPubSub();
  const publish = vi.spyOn(pubsub, 'publish');
  const agent = { id: 'continuation-agent' } as Agent<any, any, any, any>;
  const options = { memory: { thread: 'continuation-thread', resource: 'continuation-user' } };
  const runId = crypto.randomUUID();
  const makeStream = (options?: { closeOnSuspend?: boolean; runId?: string }) =>
    createDurableAgentStream({
      pubsub,
      runId: options?.runId ?? runId,
      messageId: crypto.randomUUID(),
      model: { modelId: 'mock', provider: 'mock', version: 'v3' },
      closeOnSuspend: options?.closeOnSuspend,
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
    const resumedAgainContext = new RequestContext();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, { ...h.options, requestContext: initialContext }, h.pubsub, {
      continuation: 'across-suspension',
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
      expect(subscription.__getCurrentRunRequestContext!()).toBe(initialContext);
    }
    const resumed = h.makeStream();
    await resumed.ready;
    expect(
      h.runtime.continueRun(
        h.agent,
        resumed.output,
        {
          ...h.options,
          requestContext: resumedContext,
          toolCallId: 'call-1',
        } as any,
        h.pubsub,
      ),
    ).toBe(true);
    expect(h.registrations()).toHaveLength(1);
    if (!delayed) expect(subscription.__getCurrentRunRequestContext!()).toBe(resumedContext);

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

    await h.chunk('tool-call-approval', { toolCallId: 'call-2', toolName: 'read_page', args: {} });
    await vi.waitFor(() => expect(resumed.output.status).toBe('suspended'));
    const resumedAgain = h.makeStream();
    await resumedAgain.ready;
    expect(
      h.runtime.continueRun(
        h.agent,
        resumedAgain.output,
        {
          ...h.options,
          requestContext: resumedAgainContext,
          toolCallId: 'call-2',
        } as any,
        h.pubsub,
      ),
    ).toBe(true);
    expect(h.registrations()).toHaveLength(1);
    if (!delayed) expect(subscription.__getCurrentRunRequestContext!()).toBe(resumedAgainContext);

    await h.chunk('text-delta', { text: 'answer' });
    await h.finish();
    // No caller reads either resumed fullStream; continuation must drain both.
    await Promise.all([resumed.output._waitUntilFinished(), resumedAgain.output._waitUntilFinished()]);
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
    resumedAgain.cleanup();
    await h.pubsub.close();
  });

  it('registers a replacement after the original adapter was cleaned up', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    await h.chunk('tool-call-approval', { toolCallId: 'call-1', toolName: 'read_page', args: {} });
    await vi.waitFor(() => expect(first.output.status).toBe('suspended'));
    expect(h.runtime.closeRunContinuation(first.output, h.pubsub)).toBe(true);
    first.cleanup();
    const resumed = h.makeStream();
    await resumed.ready;
    expect(h.runtime.continueRun(h.agent, resumed.output, h.options, h.pubsub)).toBe(false);
    await h.runtime.registerRun(h.agent, resumed.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
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

  it('does not continue a registration that was not declared suspension-spanning', async () => {
    const h = setup();
    const first = h.makeStream({ closeOnSuspend: true });
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub);
    await h.chunk('tool-call-approval', { toolCallId: 'call-1', toolName: 'read_page', args: {} });
    await vi.waitFor(() => expect(first.output.status).toBe('suspended'));

    const resumed = h.makeStream();
    await resumed.ready;
    expect(h.runtime.continueRun(h.agent, resumed.output, h.options, h.pubsub)).toBe(false);
    await h.runtime.registerRun(h.agent, resumed.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    expect(h.registrations()).toHaveLength(2);

    await h.finish();
    await resumed.output._waitUntilFinished();
    first.cleanup();
    resumed.cleanup();
    await h.pubsub.close();
  });

  it('rejects continuation when the local run identity does not match', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    await h.chunk('tool-call-approval', { toolCallId: 'call-1', toolName: 'read_page', args: {} });
    await vi.waitFor(() => expect(first.output.status).toBe('suspended'));

    const resumed = h.makeStream();
    await resumed.ready;
    const otherAgent = { id: h.agent.id } as Agent<any, any, any, any>;
    expect(h.runtime.continueRun(otherAgent, resumed.output, h.options, h.pubsub)).toBe(false);
    expect(
      h.runtime.continueRun(
        h.agent,
        resumed.output,
        { memory: { ...h.options.memory, thread: 'other-thread' } },
        h.pubsub,
      ),
    ).toBe(false);
    expect(
      h.runtime.continueRun(
        h.agent,
        resumed.output,
        { memory: { ...h.options.memory, resource: 'other-resource' } },
        h.pubsub,
      ),
    ).toBe(false);
    expect(h.runtime.closeRunContinuation(resumed.output, h.pubsub)).toBe(false);
    expect(h.runtime.continueRun(h.agent, resumed.output, h.options, h.pubsub)).toBe(true);

    await h.finish();
    await resumed.output._waitUntilFinished();
    first.cleanup();
    resumed.cleanup();
    await h.pubsub.close();
  });

  it('returns false when no live local broadcast exists', async () => {
    const h = setup();
    const output = h.makeStream();
    await output.ready;
    expect(h.runtime.continueRun(h.agent, output.output, h.options, h.pubsub)).toBe(false);
    output.cleanup();
    await h.pubsub.close();
  });

  it('returns false after the broadcast pump terminates', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    await h.finish();
    await first.output._waitUntilFinished();

    const resumed = h.makeStream();
    await resumed.ready;
    expect(h.runtime.continueRun(h.agent, resumed.output, h.options, h.pubsub)).toBe(false);
    expect(h.registrations()).toHaveLength(1);
    first.cleanup();
    resumed.cleanup();
    await h.pubsub.close();
  });

  it('always creates a new registration when registerRun is called', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });

    const replacement = h.makeStream();
    await replacement.ready;
    await h.runtime.registerRun(h.agent, replacement.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    expect(h.registrations()).toHaveLength(2);

    await h.finish();
    await Promise.all([first.output._waitUntilFinished(), replacement.output._waitUntilFinished()]);
    first.cleanup();
    replacement.cleanup();
    await h.pubsub.close();
  });

  it('returns false after the broadcast pump errors', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    await emitErrorEvent(h.pubsub, h.runId, new Error('broadcast failed'));
    await vi.waitFor(() => expect(first.output.status).toBe('failed'));

    const resumed = h.makeStream();
    await resumed.ready;
    expect(h.runtime.continueRun(h.agent, resumed.output, h.options, h.pubsub)).toBe(false);
    first.cleanup();
    resumed.cleanup();
    await h.pubsub.close();
  });

  it('keeps strict recovery ownership validation even for a live same-run stream', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    const recovered = h.makeStream();
    await recovered.ready;
    await expect(
      h.runtime.registerRun(h.agent, recovered.output, h.options, h.pubsub, {
        strict: true,
        continuation: 'across-suspension',
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
