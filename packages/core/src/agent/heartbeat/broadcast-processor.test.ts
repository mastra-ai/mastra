import { describe, it, expect } from 'vitest';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import { createHeartbeatBroadcastProcessor, HEARTBEAT_BROADCAST_PROCESSOR_NAME } from './broadcast-processor';

const RUN_ID = 'run-1';

function chunk(type: string, payload: Record<string, unknown> = {}): ChunkType {
  return { type, runId: RUN_ID, from: ChunkFrom.AGENT, payload } as unknown as ChunkType;
}

function textDelta(text: string): ChunkType {
  return chunk('text-delta', { id: 't1', text });
}

function finishChunk(): ChunkType {
  return chunk('finish', { stepResult: { reason: 'stop' } });
}

function makeContext(controllerEnqueued?: ChunkType[]) {
  const state: Record<string, unknown> = {};
  if (controllerEnqueued) {
    state.controller = {
      enqueue: (c: ChunkType) => {
        controllerEnqueued.push(c);
      },
    };
  }
  return {
    state,
    streamParts: [] as ChunkType[],
    requestContext: undefined as any,
  };
}

describe('createHeartbeatBroadcastProcessor', () => {
  it('exposes the well-known id', () => {
    const p = createHeartbeatBroadcastProcessor({ mode: 'live', scheduleId: 'hb_a' });
    expect(p.id).toBe(HEARTBEAT_BROADCAST_PROCESSOR_NAME);
  });

  describe('mode: live', () => {
    it('passes every chunk through unchanged', async () => {
      const p = createHeartbeatBroadcastProcessor({ mode: 'live', scheduleId: 'hb_a' });
      const ctx = makeContext();
      const parts = [
        chunk('start'),
        chunk('step-start'),
        chunk('text-start', { id: 't1' }),
        textDelta('hello '),
        textDelta('world'),
        chunk('text-end', { id: 't1' }),
        chunk('step-finish'),
        finishChunk(),
      ];
      const out: (ChunkType | null | undefined)[] = [];
      for (const part of parts) {
        out.push(await p.processOutputStream!({ part, ...ctx } as any));
      }
      expect(out).toEqual(parts);
    });

    it('emits data-heartbeat-run-start once and data-heartbeat-run-finish on finish', async () => {
      const p = createHeartbeatBroadcastProcessor({
        mode: 'live',
        scheduleId: 'hb_a',
        threadId: 't1',
      });
      const enqueued: ChunkType[] = [];
      const ctx = makeContext(enqueued);
      await p.processOutputStream!({ part: chunk('start'), ...ctx } as any);
      await p.processOutputStream!({ part: textDelta('x'), ...ctx } as any);
      await p.processOutputStream!({ part: textDelta('y'), ...ctx } as any);
      await p.processOutputStream!({ part: finishChunk(), ...ctx } as any);
      const lifecycle = enqueued.filter(c => String(c.type).startsWith('data-heartbeat-run-'));
      expect(lifecycle.map(c => c.type)).toEqual(['data-heartbeat-run-start', 'data-heartbeat-run-finish']);
      const startPart = lifecycle[0] as unknown as { data: any; transient?: boolean };
      expect(startPart.transient).toBe(true);
      expect(startPart.data.scheduleId).toBe('hb_a');
      expect(startPart.data.broadcast).toBe('live');
      expect(startPart.data.threadId).toBe('t1');
      expect(typeof startPart.data.startedAt).toBe('string');
      const finishPart = lifecycle[1] as unknown as { data: any; transient?: boolean };
      expect(finishPart.transient).toBe(true);
      expect(finishPart.data.status).toBe('finished');
    });
  });

  describe('mode: never', () => {
    it('does not emit any data-heartbeat-run-* lifecycle chunks', async () => {
      const p = createHeartbeatBroadcastProcessor({ mode: 'never', scheduleId: 'hb_a' });
      const enqueued: ChunkType[] = [];
      const ctx = makeContext(enqueued);
      await p.processOutputStream!({ part: chunk('start'), ...ctx } as any);
      await p.processOutputStream!({ part: textDelta('hi'), ...ctx } as any);
      await p.processOutputStream!({ part: finishChunk(), ...ctx } as any);
      const lifecycle = enqueued.filter(c => String(c.type).startsWith('data-heartbeat-run-'));
      expect(lifecycle).toEqual([]);
    });

    it('drops every non-terminal chunk', async () => {
      const p = createHeartbeatBroadcastProcessor({ mode: 'never', scheduleId: 'hb_a' });
      const ctx = makeContext();
      const parts = [
        chunk('start'),
        chunk('step-start'),
        chunk('text-start', { id: 't1' }),
        textDelta('hello'),
        chunk('text-end', { id: 't1' }),
        chunk('step-finish'),
        finishChunk(),
      ];
      for (const part of parts) {
        expect(await p.processOutputStream!({ part, ...ctx } as any)).toBeNull();
      }
    });

    it('passes error and abort chunks through', async () => {
      const p = createHeartbeatBroadcastProcessor({ mode: 'never', scheduleId: 'hb_a' });
      const ctx = makeContext();
      const err = chunk('error', { error: 'boom' });
      const abort = chunk('abort', {});
      expect(await p.processOutputStream!({ part: err, ...ctx } as any)).toEqual(err);
      expect(await p.processOutputStream!({ part: abort, ...ctx } as any)).toEqual(abort);
    });
  });

  describe('mode: on-complete', () => {
    it('buffers text deltas, drops intermediates, bursts on finish', async () => {
      const p = createHeartbeatBroadcastProcessor({ mode: 'on-complete', scheduleId: 'hb_a' });
      const enqueued: ChunkType[] = [];
      const ctx = makeContext(enqueued);

      const start = chunk('start');
      expect(await p.processOutputStream!({ part: start, ...ctx } as any)).toEqual(start);

      expect(await p.processOutputStream!({ part: chunk('step-start'), ...ctx } as any)).toBeNull();
      expect(await p.processOutputStream!({ part: chunk('text-start', { id: 't1' }), ...ctx } as any)).toBeNull();
      expect(await p.processOutputStream!({ part: textDelta('hello '), ...ctx } as any)).toBeNull();
      expect(await p.processOutputStream!({ part: textDelta('world'), ...ctx } as any)).toBeNull();
      expect(await p.processOutputStream!({ part: chunk('text-end', { id: 't1' }), ...ctx } as any)).toBeNull();
      expect(await p.processOutputStream!({ part: chunk('step-finish'), ...ctx } as any)).toBeNull();

      const finish = finishChunk();
      const result = await p.processOutputStream!({ part: finish, ...ctx } as any);
      expect(result).toEqual(finish);

      // burst order: text-start, text-delta(full), text-end (plus heartbeat-run lifecycle markers around it)
      const textBurst = enqueued.filter(c => String(c.type).startsWith('text-'));
      expect(textBurst.map(c => c.type)).toEqual(['text-start', 'text-delta', 'text-end']);
      expect(((textBurst[1] as any).payload as { text: string }).text).toBe('hello world');
      const textId = `hb-broadcast-hb_a`;
      expect(((textBurst[0] as any).payload as { id: string }).id).toBe(textId);
      expect(((textBurst[2] as any).payload as { id: string }).id).toBe(textId);
      const lifecycle = enqueued.filter(c => String(c.type).startsWith('data-heartbeat-run-'));
      expect(lifecycle.map(c => c.type)).toEqual(['data-heartbeat-run-start', 'data-heartbeat-run-finish']);
    });

    it('does not enqueue a text burst when no text was buffered', async () => {
      const p = createHeartbeatBroadcastProcessor({ mode: 'on-complete', scheduleId: 'hb_a' });
      const enqueued: ChunkType[] = [];
      const ctx = makeContext(enqueued);
      const finish = finishChunk();
      const result = await p.processOutputStream!({ part: finish, ...ctx } as any);
      expect(result).toEqual(finish);
      const textBurst = enqueued.filter(c => String(c.type).startsWith('text-'));
      expect(textBurst).toEqual([]);
    });

    it('flushes buffered text before error and abort chunks', async () => {
      for (const terminal of ['error', 'abort']) {
        const p = createHeartbeatBroadcastProcessor({ mode: 'on-complete', scheduleId: 'hb_b' });
        const enqueued: ChunkType[] = [];
        const ctx = makeContext(enqueued);
        await p.processOutputStream!({ part: textDelta('partial '), ...ctx } as any);
        await p.processOutputStream!({ part: textDelta('answer'), ...ctx } as any);
        const term = chunk(terminal, terminal === 'error' ? { error: 'boom' } : {});
        const out = await p.processOutputStream!({ part: term, ...ctx } as any);
        expect(out).toEqual(term);
        const textBurst = enqueued.filter(c => String(c.type).startsWith('text-'));
        expect(textBurst.map(c => c.type)).toEqual(['text-start', 'text-delta', 'text-end']);
        expect(((textBurst[1] as any).payload as { text: string }).text).toBe('partial answer');
        const lifecycle = enqueued.filter(c => String(c.type).startsWith('data-heartbeat-run-'));
        const finishMarker = lifecycle.find(c => c.type === 'data-heartbeat-run-finish') as unknown as { data: any };
        expect(finishMarker?.data.status).toBe(terminal === 'error' ? 'error' : 'aborted');
      }
    });

    it('drops data-* chunks', async () => {
      const p = createHeartbeatBroadcastProcessor({ mode: 'on-complete', scheduleId: 'hb_a' });
      const ctx = makeContext();
      const dataUser = chunk('data-user-message', { content: 'hi' });
      expect(await p.processOutputStream!({ part: dataUser, ...ctx } as any)).toBeNull();
    });

    it('drops tool and reasoning chunks', async () => {
      const p = createHeartbeatBroadcastProcessor({ mode: 'on-complete', scheduleId: 'hb_a' });
      const ctx = makeContext();
      const drops = [
        chunk('tool-call', {}),
        chunk('tool-result', {}),
        chunk('tool-call-input-streaming-start', {}),
        chunk('tool-call-input-streaming-end', {}),
        chunk('reasoning-start', {}),
        chunk('reasoning-delta', {}),
        chunk('reasoning-end', {}),
        chunk('source', {}),
        chunk('file', {}),
      ];
      for (const part of drops) {
        expect(await p.processOutputStream!({ part, ...ctx } as any)).toBeNull();
      }
    });
  });
});
