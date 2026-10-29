import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createDurableAgentStream, emitChunkEvent, emitErrorEvent } from '../stream-adapter';
import type { DurableAgentStreamResult } from '../stream-adapter';

describe('durable stream adapter rejection', () => {
  it('delivers chunks queued before a rejecting error to a reader that arrives late', async () => {
    const pubsub = new EventEmitterPubSub();
    const runId = 'late-reject-run';

    const { output, ready, waitForEventDelivery } = createDurableAgentStream({
      pubsub,
      runId,
      messageId: `msg-${runId}`,
      model: { modelId: 'test', provider: 'test', version: 'v3' },
    }) as DurableAgentStreamResult<any>;
    await ready;

    await emitChunkEvent(pubsub, runId, { type: 'start', runId, from: 'AGENT', payload: {} } as any);
    await emitChunkEvent(pubsub, runId, {
      type: 'step-start',
      runId,
      from: 'AGENT',
      payload: { messageId: `msg-${runId}`, request: {}, warnings: [] },
    } as any);
    await emitChunkEvent(pubsub, runId, {
      type: 'tool-call',
      runId,
      from: 'AGENT',
      payload: { toolCallId: 'call-1', toolName: 'step', args: {} },
    } as any);
    await emitErrorEvent(pubsub, runId, new Error('late failure'), undefined, 'reject');
    await waitForEventDelivery();

    const types: string[] = [];
    let error: unknown;
    try {
      for await (const chunk of output.fullStream) types.push(chunk.type);
    } catch (e) {
      error = e;
    }

    expect(types).toEqual(['start', 'step-start', 'tool-call']);
    expect((error as Error)?.message).toBe('late failure');
    await pubsub.close();
  });

  it('delivers chunks queued before a failed subscription to a reader that arrives late', async () => {
    // Replay transports can deliver events before their subscribe call settles,
    // so the subscription can still reject after chunks were queued.
    let failSubscribe!: () => void;
    const subscribeFailure = new Promise<void>(resolve => (failSubscribe = resolve));
    class FailingReplayPubSub extends EventEmitterPubSub {
      override async subscribeWithReplay(...args: Parameters<EventEmitterPubSub['subscribeWithReplay']>) {
        await super.subscribeWithReplay(...args);
        await subscribeFailure;
        throw new Error('subscribe failed');
      }
    }
    const pubsub = new FailingReplayPubSub();
    const runId = 'late-subscribe-failure-run';

    const { output, ready, waitForEventDelivery } = createDurableAgentStream({
      pubsub,
      runId,
      messageId: `msg-${runId}`,
      model: { modelId: 'test', provider: 'test', version: 'v3' },
    }) as DurableAgentStreamResult<any>;

    await emitChunkEvent(pubsub, runId, { type: 'start', runId, from: 'AGENT', payload: {} } as any);
    await emitChunkEvent(pubsub, runId, {
      type: 'step-start',
      runId,
      from: 'AGENT',
      payload: { messageId: `msg-${runId}`, request: {}, warnings: [] },
    } as any);
    await waitForEventDelivery();
    failSubscribe();
    await expect(ready).rejects.toThrow('subscribe failed');

    const types: string[] = [];
    let error: unknown;
    try {
      for await (const chunk of output.fullStream) types.push(chunk.type);
    } catch (e) {
      error = e;
    }

    expect(types).toEqual(['start', 'step-start']);
    expect((error as Error)?.message).toBe('subscribe failed');
    await pubsub.close();
  });

  it('keeps the run error when the subscription fails after it', async () => {
    let failSubscribe!: () => void;
    const subscribeFailure = new Promise<void>(resolve => (failSubscribe = resolve));
    class FailingReplayPubSub extends EventEmitterPubSub {
      override async subscribeWithReplay(...args: Parameters<EventEmitterPubSub['subscribeWithReplay']>) {
        await super.subscribeWithReplay(...args);
        await subscribeFailure;
        throw new Error('subscribe failed');
      }
    }
    const pubsub = new FailingReplayPubSub();
    const runId = 'run-error-then-subscribe-failure';

    const { output, ready, waitForEventDelivery } = createDurableAgentStream({
      pubsub,
      runId,
      messageId: `msg-${runId}`,
      model: { modelId: 'test', provider: 'test', version: 'v3' },
    }) as DurableAgentStreamResult<any>;

    await emitChunkEvent(pubsub, runId, { type: 'start', runId, from: 'AGENT', payload: {} } as any);
    await emitChunkEvent(pubsub, runId, {
      type: 'step-start',
      runId,
      from: 'AGENT',
      payload: { messageId: `msg-${runId}`, request: {}, warnings: [] },
    } as any);
    await emitErrorEvent(pubsub, runId, new Error('run failed'), undefined, 'reject');
    await waitForEventDelivery();
    failSubscribe();
    await expect(ready).rejects.toThrow('subscribe failed');

    const types: string[] = [];
    let error: unknown;
    try {
      for await (const chunk of output.fullStream) types.push(chunk.type);
    } catch (e) {
      error = e;
    }

    expect(types).toEqual(['start', 'step-start']);
    expect((error as Error)?.message).toBe('run failed');
    await pubsub.close();
  });
});
