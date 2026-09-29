import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { ChunkFrom } from '../../stream/types';
import type { ChunkType } from '../../stream/types';
import { AGENT_STREAM_TOPIC } from './constants';
import { emitChunkEvent, emitStepStartEvent } from './stream-adapter';

describe('durable chunk messageId stamping', () => {
  it('stamps chunks with the message id passed by the emitting step, without per-process state', async () => {
    const pubsub = new EventEmitterPubSub();
    const runId = 'run-1';
    const received: any[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      received.push(event.data);
    });

    const text = (t: string) =>
      ({ type: 'text-delta', runId, from: ChunkFrom.AGENT, payload: { id: 't', text: t } }) as ChunkType;

    await emitStepStartEvent(pubsub, runId, { messageId: 'msg-a' });
    await emitChunkEvent(pubsub, runId, text('one'), 'msg-a');
    // A resumed step in another process has seen no step-start; the id comes from step input.
    await emitChunkEvent(pubsub, runId, text('resumed'), 'msg-b');
    await emitChunkEvent(pubsub, runId, { ...text('explicit'), messageId: 'msg-x' }, 'msg-b');
    // Nothing is inferred from an earlier step-start.
    await emitChunkEvent(pubsub, runId, text('no-id'));
    await emitChunkEvent(
      pubsub,
      runId,
      { type: 'start', runId, from: ChunkFrom.AGENT, payload: {} } as ChunkType,
      'msg-a',
    );

    const byText = (t: string) => received.find(d => d?.payload?.text === t);
    expect(byText('one').messageId).toBe('msg-a');
    expect(byText('resumed').messageId).toBe('msg-b');
    expect(byText('explicit').messageId).toBe('msg-x');
    expect(byText('no-id').messageId).toBeUndefined();
    expect(received.find(d => d?.type === 'start').messageId).toBeUndefined();
    expect(received.find(d => d?.type === 'step-start').messageId).toBe('msg-a');
  });
});
