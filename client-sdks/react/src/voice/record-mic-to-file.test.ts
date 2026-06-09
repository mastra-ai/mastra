// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordMicrophoneToFile } from './record-mic-to-file';

type FakeMediaRecorder = {
  ondataavailable: ((event: { data: BlobPart }) => void) | null;
  onstop: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

let getUserMediaMock: ReturnType<typeof vi.fn>;
let trackStopMock: ReturnType<typeof vi.fn>;
let getTracksMock: ReturnType<typeof vi.fn>;
let lastRecorder: FakeMediaRecorder;

beforeEach(() => {
  trackStopMock = vi.fn();
  getTracksMock = vi.fn(() => [{ stop: trackStopMock }, { stop: trackStopMock }]);

  getUserMediaMock = vi.fn(async () => ({ getTracks: getTracksMock }) as unknown as MediaStream);

  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: getUserMediaMock },
  });

  class FakeRecorder implements FakeMediaRecorder {
    ondataavailable: ((event: { data: BlobPart }) => void) | null = null;
    onstop: (() => void) | null = null;
    start = vi.fn();
    stop = vi.fn();
    constructor() {
      lastRecorder = this;
    }
  }

  vi.stubGlobal('MediaRecorder', FakeRecorder as unknown as typeof MediaRecorder);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('recordMicrophoneToFile', () => {
  it('requests microphone access with audio enabled', async () => {
    await recordMicrophoneToFile(vi.fn());
    expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true });
  });

  it('returns the created MediaRecorder', async () => {
    const recorder = await recordMicrophoneToFile(vi.fn());
    expect(recorder).toBe(lastRecorder as unknown as MediaRecorder);
  });

  it('builds a webm File from collected chunks and calls onFinish on stop', async () => {
    const onFinish = vi.fn();
    await recordMicrophoneToFile(onFinish);

    lastRecorder.ondataavailable?.({ data: new Blob(['chunk-1']) });
    lastRecorder.ondataavailable?.({ data: new Blob(['chunk-2']) });

    lastRecorder.onstop?.();

    expect(onFinish).toHaveBeenCalledTimes(1);
    const file = onFinish.mock.calls[0]![0] as File;
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('audio/webm');
    expect(file.name).toMatch(/^recording-\d+\.webm$/);
    expect(file.size).toBeGreaterThan(0);
  });

  it('stops all media tracks on stop', async () => {
    await recordMicrophoneToFile(vi.fn());
    lastRecorder.onstop?.();
    expect(getTracksMock).toHaveBeenCalled();
    expect(trackStopMock).toHaveBeenCalledTimes(2);
  });
});
