import { ReadableStream } from 'node:stream/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { smoothStream } from './smooth-stream';
import type { SmoothStreamOptions } from './smooth-stream';
import { ChunkFrom } from './types';
import type { ChunkType } from './types';

const baseChunk = {
  runId: 'run-1',
  from: ChunkFrom.AGENT,
};

function textDelta(text: string, id = 'text-1', extra: Record<string, unknown> = {}): ChunkType {
  return {
    ...baseChunk,
    ...extra,
    type: 'text-delta',
    payload: { id, text, ...((extra.payload as Record<string, unknown> | undefined) ?? {}) },
  } as ChunkType;
}

function reasoningDelta(text: string, id = 'reasoning-1'): ChunkType {
  return {
    ...baseChunk,
    type: 'reasoning-delta',
    payload: { id, text },
  };
}

function controlChunk(type: string, payload: Record<string, unknown> = {}): ChunkType {
  return { ...baseChunk, type, payload } as ChunkType;
}

async function collect(chunks: ChunkType[], options: SmoothStreamOptions = {}): Promise<ChunkType[]> {
  const source = new ReadableStream<ChunkType>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  const output: ChunkType[] = [];
  for await (const chunk of source.pipeThrough(smoothStream(options))) {
    output.push(chunk);
  }
  return output;
}

function deltas(chunks: ChunkType[]) {
  return chunks
    .filter(
      (chunk): chunk is Extract<ChunkType, { type: 'text-delta' | 'reasoning-delta' }> =>
        chunk.type === 'text-delta' || chunk.type === 'reasoning-delta',
    )
    .map(chunk => ({ type: chunk.type, id: chunk.payload.id, text: chunk.payload.text }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('smoothStream', () => {
  it('smooths words across provider delta boundaries and flushes trailing text', async () => {
    const output = await collect(
      [
        controlChunk('text-start', { id: 'text-1' }),
        textDelta('Hel'),
        textDelta('lo world'),
        controlChunk('text-end', { id: 'text-1' }),
      ],
      { delayInMs: null },
    );

    expect(output.map(chunk => chunk.type)).toEqual(['text-start', 'text-delta', 'text-delta', 'text-end']);
    expect(deltas(output)).toEqual([
      { type: 'text-delta', id: 'text-1', text: 'Hello ' },
      { type: 'text-delta', id: 'text-1', text: 'world' },
    ]);
  });

  it('emits multiple complete words from one provider delta', async () => {
    const output = await collect([textDelta('one two three ')], { delayInMs: null });

    expect(deltas(output)).toEqual([
      { type: 'text-delta', id: 'text-1', text: 'one ' },
      { type: 'text-delta', id: 'text-1', text: 'two ' },
      { type: 'text-delta', id: 'text-1', text: 'three ' },
    ]);
  });

  it('supports line chunking', async () => {
    const output = await collect([textDelta('first\nsecond\nthird')], {
      chunking: 'line',
      delayInMs: null,
    });

    expect(deltas(output).map(chunk => chunk.text)).toEqual(['first\n', 'second\n', 'third']);
  });

  it('supports regular expression chunking', async () => {
    const output = await collect([textDelta('first, second, third')], {
      chunking: /[^,]*,\s*/,
      delayInMs: null,
    });

    expect(deltas(output).map(chunk => chunk.text)).toEqual(['first, ', 'second, ', 'third']);
  });

  it('supports custom chunk detectors', async () => {
    const output = await collect([textDelta('First. Second. Final')], {
      chunking: buffer => {
        const boundary = buffer.indexOf('. ');
        return boundary === -1 ? null : buffer.slice(0, boundary + 2);
      },
      delayInMs: null,
    });

    expect(deltas(output).map(chunk => chunk.text)).toEqual(['First. ', 'Second. ', 'Final']);
  });

  it('supports locale-aware Intl.Segmenter chunking', async () => {
    const output = await collect([textDelta('こんにちは世界')], {
      chunking: new Intl.Segmenter('ja', { granularity: 'word' }),
      delayInMs: null,
    });

    expect(deltas(output).map(chunk => chunk.text)).toEqual(['こんにちは', '世界']);
  });

  it('keeps text, reasoning, and part ids in separate buffers', async () => {
    const output = await collect(
      [reasoningDelta('first'), reasoningDelta(' second', 'reasoning-2'), textDelta('answer')],
      { delayInMs: null },
    );

    expect(deltas(output)).toEqual([
      { type: 'reasoning-delta', id: 'reasoning-1', text: 'first' },
      { type: 'reasoning-delta', id: 'reasoning-2', text: ' second' },
      { type: 'text-delta', id: 'text-1', text: 'answer' },
    ]);
  });

  it('flushes buffered text before tool, finish, and control chunks without modifying them', async () => {
    const toolCall = controlChunk('tool-call', { toolCallId: 'call-1', toolName: 'weather' });
    const finish = controlChunk('finish', { reason: 'stop' });
    const metadata = controlChunk('response-metadata', { modelId: 'model-1' });

    const output = await collect([textDelta('before tool'), toolCall, textDelta('before finish'), finish, metadata], {
      delayInMs: null,
    });

    expect(deltas(output).map(chunk => chunk.text)).toEqual(['before ', 'tool', 'before ', 'finish']);
    expect(output[2]).toBe(toolCall);
    expect(output[5]).toBe(finish);
    expect(output[6]).toBe(metadata);
  });

  it('preserves chunk and provider metadata without duplicating it across emitted chunks', async () => {
    const output = await collect(
      [
        textDelta('one two ', 'text-1', {
          metadata: { source: 'model' },
          payload: { providerMetadata: { test: { signature: 'signature-1' } } },
        }),
      ],
      { delayInMs: null },
    );

    const [first, second] = output as Array<Extract<ChunkType, { type: 'text-delta' }>>;
    expect(first).toMatchObject({
      runId: 'run-1',
      from: ChunkFrom.AGENT,
      metadata: { source: 'model' },
      payload: {
        id: 'text-1',
        text: 'one ',
        providerMetadata: { test: { signature: 'signature-1' } },
      },
    });
    expect(second).toEqual(textDelta('two '));
    expect(output.map(chunk => (chunk.type === 'text-delta' ? chunk.payload.text : '')).join('')).toBe('one two ');
  });

  it.each([
    ['empty', () => ''],
    ['non-prefix', () => 'different'],
  ])('rejects %s custom detector results', async (_name, chunking) => {
    await expect(collect([textDelta('buffer')], { chunking, delayInMs: null })).rejects.toThrow(TypeError);
  });

  it('rejects regular expressions that produce empty chunks', async () => {
    await expect(collect([textDelta('buffer')], { chunking: /^/, delayInMs: null })).rejects.toThrow(
      'The chunking RegExp must match a non-empty string.',
    );
  });

  it('uses configured delays between emitted chunks', async () => {
    vi.useFakeTimers();

    const source = new ReadableStream<ChunkType>({
      start(controller) {
        controller.enqueue(textDelta('one two '));
        controller.close();
      },
    });
    const reader = source.pipeThrough(smoothStream({ delayInMs: 20 })).getReader();

    const first = await reader.read();
    expect(first.value).toMatchObject({ type: 'text-delta', payload: { text: 'one ' } });
    expect(vi.getTimerCount()).toBe(1);

    const secondPromise = reader.read();
    await vi.advanceTimersByTimeAsync(20);
    const second = await secondPromise;
    expect(second.value).toMatchObject({ type: 'text-delta', payload: { text: 'two ' } });
    expect(vi.getTimerCount()).toBe(1);

    const donePromise = reader.read();
    await vi.advanceTimersByTimeAsync(20);

    await expect(donePromise).resolves.toEqual({ done: true, value: undefined });
  });
});
