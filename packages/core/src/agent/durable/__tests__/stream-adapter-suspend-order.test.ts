import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createDurableAgentStream, emitChunkEvent, emitFinishEvent, emitSuspendedEvent } from '../stream-adapter';
import type { DurableAgentStreamResult } from '../stream-adapter';

const suspendedData = { toolCallId: 'call-1', toolName: 'askTool', suspendPayload: {} } as any;

describe('durable stream adapter suspension ordering', () => {
  it('runs onSuspended after the chunk delivered in the same tick, and closes under closeOnSuspend', async () => {
    const pubsub = new EventEmitterPubSub();
    const runId = 'suspend-order-run';
    // Same wiring as the Inngest resume gate: a flag set in onChunk decides whether the suspension counts.
    let chunkSeen = false;
    const seenAtSuspend: boolean[] = [];

    const { output } = createDurableAgentStream({
      pubsub,
      runId,
      messageId: `msg-${runId}`,
      model: { modelId: 'test', provider: 'test', version: 'v3' },
      closeOnSuspend: true,
      onChunk: () => {
        chunkSeen = true;
      },
      onSuspended: () => {
        seenAtSuspend.push(chunkSeen);
      },
    }) as DurableAgentStreamResult<any>;

    const reading = (async () => {
      for await (const _chunk of output.fullStream) {
        // drain
      }
    })();

    // A live transport can deliver a re-suspending segment's only chunk and its SUSPENDED without yielding.
    await Promise.all([
      emitChunkEvent(pubsub, runId, {
        type: 'tool-call-suspended',
        runId,
        from: 'AGENT',
        payload: { toolCallId: 'call-1', toolName: 'askTool', suspendPayload: {} },
      } as any),
      emitSuspendedEvent(pubsub, runId, suspendedData),
    ]);

    await reading;
    expect(seenAtSuspend).toEqual([true]);
    await pubsub.close();
  });

  it('keeps an open stream pending across approval until the resumed segment finishes', async () => {
    const pubsub = new EventEmitterPubSub();
    const runId = 'open-approval-run';
    const { output, ready } = createDurableAgentStream({
      pubsub,
      runId,
      messageId: `msg-${runId}`,
      model: { modelId: 'test', provider: 'test', version: 'v3' },
      closeOnSuspend: false,
    });
    const fullOutput = output.getFullOutput();
    const text = output.text;
    let settled = false;
    void text.then(() => {
      settled = true;
    });
    await ready;

    await emitChunkEvent(pubsub, runId, {
      type: 'text-delta',
      runId,
      from: 'AGENT',
      payload: { text: 'before ' },
    } as any);
    await emitChunkEvent(pubsub, runId, {
      type: 'tool-call-suspended',
      runId,
      from: 'AGENT',
      payload: suspendedData,
    } as any);
    await emitSuspendedEvent(pubsub, runId, suspendedData);
    await Promise.resolve();
    expect(settled).toBe(false);

    await emitChunkEvent(pubsub, runId, {
      type: 'text-delta',
      runId,
      from: 'AGENT',
      payload: { text: 'after' },
    } as any);
    await emitFinishEvent(pubsub, runId, { output: { text: 'before after' }, stepResult: { reason: 'stop' } } as any);
    expect(await text).toBe('before after');
    expect((await fullOutput).text).toBe('before after');
    await pubsub.close();
  });

  it('includes restored prior text in full output when the resumed step finishes', async () => {
    const pubsub = new EventEmitterPubSub();
    const runId = 'resumed-full-output-run';
    const { output, ready } = createDurableAgentStream({
      pubsub,
      runId,
      messageId: `msg-${runId}`,
      model: { modelId: 'test', provider: 'test', version: 'v3' },
      resumedText: { priorText: 'A ', stepText: 'B ' },
    });
    const fullOutput = output.getFullOutput();
    await ready;
    await emitChunkEvent(pubsub, runId, {
      type: 'text-delta',
      runId,
      from: 'AGENT',
      payload: { text: 'C' },
    } as any);
    await emitChunkEvent(pubsub, runId, {
      type: 'step-finish',
      runId,
      from: 'AGENT',
      payload: {
        output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, steps: [] },
        stepResult: { reason: 'stop' },
        metadata: {},
      },
    } as any);
    await emitFinishEvent(pubsub, runId, { output: { text: 'A B C' }, stepResult: { reason: 'stop' } } as any);
    expect(await output.text).toBe('A B C');
    expect((await fullOutput).text).toBe('A B C');
    await pubsub.close();
  });
});
