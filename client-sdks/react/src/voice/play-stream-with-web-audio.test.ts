// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playStreamWithWebAudio } from './play-stream-with-web-audio';

let decodeAudioDataMock: ReturnType<typeof vi.fn>;
let createBufferSourceMock: ReturnType<typeof vi.fn>;
let connectMock: ReturnType<typeof vi.fn>;
let startMock: ReturnType<typeof vi.fn>;
let stopMock: ReturnType<typeof vi.fn>;
let closeMock: ReturnType<typeof vi.fn>;
let decodedBuffer: object;
let lastSource: { buffer: unknown; connect: typeof connectMock; start: typeof startMock; stop: typeof stopMock };

beforeEach(() => {
  decodedBuffer = { decoded: true };
  decodeAudioDataMock = vi.fn(async () => decodedBuffer);
  connectMock = vi.fn();
  startMock = vi.fn();
  stopMock = vi.fn();
  closeMock = vi.fn(async () => {});

  createBufferSourceMock = vi.fn(() => {
    lastSource = { buffer: null, connect: connectMock, start: startMock, stop: stopMock };
    return lastSource;
  });

  class FakeAudioContext {
    destination = { id: 'destination' };
    decodeAudioData = decodeAudioDataMock;
    createBufferSource = createBufferSourceMock;
    close = closeMock;
  }

  vi.stubGlobal('AudioContext', FakeAudioContext as unknown as typeof AudioContext);
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: FakeAudioContext,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const streamFromChunks = (chunks: Uint8Array[]): ReadableStream => {
  let i = 0;
  return {
    getReader: () => ({
      read: async () => {
        if (i < chunks.length) {
          return { done: false, value: chunks[i++] };
        }
        return { done: true, value: undefined };
      },
    }),
  } as unknown as ReadableStream;
};

describe('playStreamWithWebAudio', () => {
  it('concatenates chunks and decodes the combined buffer', async () => {
    const stream = streamFromChunks([new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])]);
    await playStreamWithWebAudio(stream);

    expect(decodeAudioDataMock).toHaveBeenCalledTimes(1);
    const decodedArg = new Uint8Array(decodeAudioDataMock.mock.calls[0]![0] as ArrayBuffer);
    expect(Array.from(decodedArg)).toEqual([1, 2, 3, 4, 5]);
  });

  it('plays the decoded buffer through a connected buffer source', async () => {
    const stream = streamFromChunks([new Uint8Array([1])]);
    await playStreamWithWebAudio(stream);

    expect(createBufferSourceMock).toHaveBeenCalledTimes(1);
    expect(lastSource.buffer).toBe(decodedBuffer);
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it('returns a cleanup that stops the source and closes the context', async () => {
    const stream = streamFromChunks([new Uint8Array([1])]);
    const cleanup = await playStreamWithWebAudio(stream);

    expect(stopMock).not.toHaveBeenCalled();
    expect(closeMock).not.toHaveBeenCalled();

    cleanup();

    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
