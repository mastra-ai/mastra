import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readWithKeepalive } from './stream-keepalive';

async function collect<T>(source: ReadableStream<T>, keepaliveMs: number, advance?: () => Promise<void>) {
  const reads: Array<{ type: 'chunk'; value: T } | { type: 'keepalive' }> = [];
  const done = (async () => {
    for await (const read of readWithKeepalive(source.getReader(), keepaliveMs)) {
      reads.push(read);
    }
  })();
  await advance?.();
  await done;
  return reads;
}

describe('readWithKeepalive', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('yields chunks without keepalives when the source is not idle', async () => {
    const source = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('a');
        controller.enqueue('b');
        controller.close();
      },
    });

    const reads = await collect(source, 1000);

    expect(reads).toEqual([
      { type: 'chunk', value: 'a' },
      { type: 'chunk', value: 'b' },
    ]);
  });

  it('yields keepalives while the source is idle, then the chunk that follows', async () => {
    let controller!: ReadableStreamDefaultController<string>;
    const source = new ReadableStream<string>({
      start(c) {
        controller = c;
      },
    });

    const reads = await collect(source, 1000, async () => {
      await vi.advanceTimersByTimeAsync(2500);
      controller.enqueue('after-idle');
      controller.close();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(reads).toEqual([{ type: 'keepalive' }, { type: 'keepalive' }, { type: 'chunk', value: 'after-idle' }]);
  });

  it('never emits keepalives when disabled', async () => {
    let controller!: ReadableStreamDefaultController<string>;
    const source = new ReadableStream<string>({
      start(c) {
        controller = c;
      },
    });

    const reads = await collect(source, 0, async () => {
      await vi.advanceTimersByTimeAsync(60_000);
      controller.enqueue('a');
      controller.close();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(reads).toEqual([{ type: 'chunk', value: 'a' }]);
  });

  it('propagates source errors', async () => {
    const source = new ReadableStream<string>({
      start(controller) {
        controller.error(new Error('boom'));
      },
    });

    await expect(collect(source, 1000)).rejects.toThrow('boom');
  });
});
