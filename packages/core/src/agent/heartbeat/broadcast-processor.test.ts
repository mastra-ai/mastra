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
  });

  describe('mode: never', () => {
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

      // burst order: text-start, text-delta(full), text-end
      expect(enqueued.map(c => c.type)).toEqual(['text-start', 'text-delta', 'text-end']);
      expect(((enqueued[1] as any).payload as { text: string }).text).toBe('hello world');
      const textId = `hb-broadcast-hb_a`;
      expect(((enqueued[0] as any).payload as { id: string }).id).toBe(textId);
      expect(((enqueued[2] as any).payload as { id: string }).id).toBe(textId);
    });

    it('does not enqueue a burst when no text was buffered', async () => {
      const p = createHeartbeatBroadcastProcessor({ mode: 'on-complete', scheduleId: 'hb_a' });
      const enqueued: ChunkType[] = [];
      const ctx = makeContext(enqueued);
      const finish = finishChunk();
      const result = await p.processOutputStream!({ part: finish, ...ctx } as any);
      expect(result).toEqual(finish);
      expect(enqueued).toEqual([]);
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
        expect(enqueued.map(c => c.type)).toEqual(['text-start', 'text-delta', 'text-end']);
        expect(((enqueued[1] as any).payload as { text: string }).text).toBe('partial answer');
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
