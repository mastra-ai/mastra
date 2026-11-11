import { ReadableStream } from 'node:stream/web';
import { describe, expect, it, vi } from 'vitest';
import { ChunkFrom } from '../../stream/types';
import type { ChunkType } from '../../stream/types';
import { detachFullStreamOnEnd } from './observe-full-stream';

type TestChunk = ChunkType<undefined>;

function textDelta(text: string): TestChunk {
  return { type: 'text-delta', runId: 'run-1', from: ChunkFrom.AGENT, payload: { id: 'id-1', text } };
}

/**
 * Stands in for `MastraModelOutput`: `fullStream` is a prototype getter that
 * reads a private field, so it only works when invoked with the instance as
 * receiver (as the destructurable proxy does).
 */
class FakeObserverOutput {
  #stream: ReadableStream<TestChunk>;
  receiver: unknown;
  constructor(stream: ReadableStream<TestChunk>) {
    this.#stream = stream;
  }
  get fullStream(): ReadableStream<TestChunk> {
    this.receiver = this;
    return this.#stream;
  }
}

/** Mirrors `createDestructurableOutput`'s receiver handling. */
function destructurable<T extends object>(target: T): T {
  return new Proxy(target, {
    get(t, prop) {
      return Reflect.get(t, prop, t);
    },
  });
}

describe('detachFullStreamOnEnd', () => {
  it('forwards chunks and detaches once when the source ends', async () => {
    const detach = vi.fn();
    const first = textDelta('a');
    const second = textDelta('b');
    const output = new FakeObserverOutput(
      new ReadableStream<TestChunk>({
        start(controller) {
          controller.enqueue(first);
          controller.enqueue(second);
          controller.close();
        },
      }),
    );
    detachFullStreamOnEnd(output, detach);

    const reader = output.fullStream.getReader();
    await expect(reader.read()).resolves.toEqual({ done: false, value: first });
    await expect(reader.read()).resolves.toEqual({ done: false, value: second });
    await expect(reader.read()).resolves.toEqual({ done: true, value: undefined });

    expect(detach).toHaveBeenCalledTimes(1);
  });

  it('detaches and rethrows when reading the source fails', async () => {
    const detach = vi.fn();
    const output = new FakeObserverOutput(
      new ReadableStream<TestChunk>({
        start(controller) {
          controller.error(new Error('boom'));
        },
      }),
    );
    detachFullStreamOnEnd(output, detach);

    await expect(output.fullStream.getReader().read()).rejects.toThrow('boom');

    expect(detach).toHaveBeenCalledTimes(1);
  });

  it('detaches and forwards the reason when the source is cancelled', async () => {
    const detach = vi.fn();
    const onCancel = vi.fn();
    const output = new FakeObserverOutput(new ReadableStream<TestChunk>({ cancel: onCancel }));
    detachFullStreamOnEnd(output, detach);

    await output.fullStream.getReader().cancel('stop');

    expect(detach).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledExactlyOnceWith('stop');
  });

  it('invokes the inherited getter with the real instance as receiver through a proxy', async () => {
    const detach = vi.fn();
    const output = new FakeObserverOutput(
      new ReadableStream<TestChunk>({
        start(controller) {
          controller.close();
        },
      }),
    );
    const proxied = destructurable(output);
    detachFullStreamOnEnd(proxied, detach);

    await expect(proxied.fullStream.getReader().read()).resolves.toEqual({ done: true, value: undefined });

    expect(output.receiver).toBe(output);
    expect(detach).toHaveBeenCalledTimes(1);
  });
});
