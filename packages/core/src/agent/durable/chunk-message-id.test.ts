import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { ChunkFrom } from '../../stream/types';
import type { ChunkType } from '../../stream/types';
import { AGENT_STREAM_TOPIC } from './constants';
import { emitChunkEvent, emitFinishEvent, emitStepStartEvent } from './stream-adapter';

describe('durable chunk messageId stamping', () => {
  it('stamps chunks with the message id announced by the latest step-start', async () => {
    const pubsub = new EventEmitterPubSub();
    const runId = 'run-1';
    const received: any[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      received.push(event.data);
    });

    const text = (t: string) =>
      ({ type: 'text-delta', runId, from: ChunkFrom.AGENT, payload: { id: 't', text: t } }) as ChunkType;

    await emitStepStartEvent(pubsub, runId, { messageId: 'msg-a' });
    await emitChunkEvent(pubsub, runId, text('one'));
    await emitStepStartEvent(pubsub, runId, { messageId: 'msg-b' });
    await emitChunkEvent(pubsub, runId, text('two'));
    await emitChunkEvent(pubsub, runId, { ...text('explicit'), messageId: 'msg-x' });
    await emitFinishEvent(pubsub, runId, {} as any);
    await emitChunkEvent(pubsub, runId, text('after-finish'));

    const byText = (t: string) => received.find(d => d?.payload?.text === t);
    expect(byText('one').messageId).toBe('msg-a');
    expect(byText('two').messageId).toBe('msg-b');
    expect(byText('explicit').messageId).toBe('msg-x');
    expect(byText('after-finish').messageId).toBeUndefined();
    expect(received.filter(d => d?.type === 'step-start').map(d => d.messageId)).toEqual(['msg-a', 'msg-b']);
  });
});
