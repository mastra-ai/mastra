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
let lastSource: {
  buffer: unknown;
  onended: (() => void) | null;
  connect: typeof connectMock;
  start: typeof startMock;
  stop: typeof stopMock;
};

beforeEach(() => {
  decodedBuffer = { decoded: true };
  decodeAudioDataMock = vi.fn(async () => decodedBuffer);
  connectMock = vi.fn();
  startMock = vi.fn();
  stopMock = vi.fn();
  closeMock = vi.fn(async () => {});

  createBufferSourceMock = vi.fn(() => {
    lastSource = { buffer: null, onended: null, connect: connectMock, start: startMock, stop: stopMock };
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

type ReaderMocks = {
  cancel: ReturnType<typeof vi.fn>;
  releaseLock: ReturnType<typeof vi.fn>;
};

const streamFromChunks = (chunks: Uint8Array[], readerMocks?: ReaderMocks): ReadableStream => {
  let i = 0;
  return {
    getReader: () => ({
      read: async () => {
        if (i < chunks.length) {
          return { done: false, value: chunks[i++] };
        }
        return { done: true, value: undefined };
      },
      cancel: readerMocks?.cancel ?? vi.fn(async () => {}),
      releaseLock: readerMocks?.releaseLock ?? vi.fn(),
    }),
  } as unknown as ReadableStream;
};

const failingStream = (error: Error, readerMocks: ReaderMocks): ReadableStream =>
  ({
    getReader: () => ({
      read: async () => {
        throw error;
      },
      cancel: readerMocks.cancel,
      releaseLock: readerMocks.releaseLock,
    }),
  }) as unknown as ReadableStream;

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

  it('calls onEnded when the source ends', async () => {
    const onEnded = vi.fn();
    const stream = streamFromChunks([new Uint8Array([1])]);
    await playStreamWithWebAudio(stream, onEnded);

    lastSource.onended?.();

    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('returns a cleanup that stops the source and closes the context', async () => {
    const stream = streamFromChunks([new Uint8Array([1])]);
    const cleanup = await playStreamWithWebAudio(stream);

    expect(stopMock).not.toHaveBeenCalled();
    expect(closeMock).not.toHaveBeenCalled();

    cleanup();

    expect(lastSource.onended).toBeNull();
    expect(stopMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('closes the context and releases the reader when decoding fails', async () => {
    const decodeError = new Error('decode failed');
    decodeAudioDataMock.mockRejectedValueOnce(decodeError);
    const readerMocks: ReaderMocks = { cancel: vi.fn(async () => {}), releaseLock: vi.fn() };
    const stream = streamFromChunks([new Uint8Array([1])], readerMocks);

    await expect(playStreamWithWebAudio(stream)).rejects.toBe(decodeError);

    expect(readerMocks.cancel).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(readerMocks.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('closes the context and releases the reader when reading fails', async () => {
    const readError = new Error('read failed');
    const readerMocks: ReaderMocks = { cancel: vi.fn(async () => {}), releaseLock: vi.fn() };
    const stream = failingStream(readError, readerMocks);

    await expect(playStreamWithWebAudio(stream)).rejects.toBe(readError);

    expect(readerMocks.cancel).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(readerMocks.releaseLock).toHaveBeenCalledTimes(1);
  });
});
