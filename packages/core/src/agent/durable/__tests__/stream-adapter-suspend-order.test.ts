import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createDurableAgentStream, emitChunkEvent, emitSuspendedEvent } from '../stream-adapter';
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
});
