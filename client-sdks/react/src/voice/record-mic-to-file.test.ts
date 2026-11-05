// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordMicrophoneToFile } from './record-mic-to-file';

type FakeMediaRecorder = {
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
};

let trackStopMock: ReturnType<typeof vi.fn>;
let lastRecorder: FakeMediaRecorder;
let recordedMimeType: string;

function stubRecorder(recorder: new () => FakeMediaRecorder) {
  vi.stubGlobal('MediaRecorder', recorder as unknown as typeof MediaRecorder);
}

beforeEach(() => {
  trackStopMock = vi.fn();
  recordedMimeType = '';
  const stream = { getTracks: () => [{ stop: trackStopMock }, { stop: trackStopMock }] };
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream as unknown as MediaStream) },
  });

  stubRecorder(
    class implements FakeMediaRecorder {
      mimeType = recordedMimeType;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor() {
        lastRecorder = this;
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function recordClip(chunks: Blob[]): Promise<File> {
  const onFinish = vi.fn<(file: File) => void>();
  await recordMicrophoneToFile(onFinish);
  for (const data of chunks) lastRecorder.ondataavailable?.({ data });
  lastRecorder.onstop?.();
  expect(onFinish).toHaveBeenCalledTimes(1);
  const [file] = onFinish.mock.calls[0] ?? [];
  if (!file) throw new Error('No recording was produced');
  return file;
}

describe('recordMicrophoneToFile', () => {
  it('builds a webm file from the recorded chunks when the browser does not name the format', async () => {
    const file = await recordClip([new Blob(['chunk-1']), new Blob(['chunk-2'])]);

    expect(file.type).toBe('audio/webm');
    expect(file.name).toMatch(/^recording-\d+\.webm$/);
    expect(await file.text()).toBe('chunk-1chunk-2');
  });

  it('keeps labelling a Chrome recording audio/webm, without the codecs parameter', async () => {
    recordedMimeType = 'audio/webm;codecs=opus';

    const file = await recordClip([new Blob(['opus'])]);

    expect(file.type).toBe('audio/webm');
    expect(file.name).toMatch(/^recording-\d+\.webm$/);
  });

  it('labels a Safari recording as the mp4 audio it is, so the server decodes it correctly', async () => {
    recordedMimeType = 'audio/mp4;codecs=mp4a.40.2';

    const file = await recordClip([new Blob(['aac'], { type: 'audio/mp4' })]);

    expect(file.type).toBe('audio/mp4');
    expect(file.name).toMatch(/^recording-\d+\.m4a$/);
  });

  it('labels an Opus-in-Ogg recording with its own type and extension', async () => {
    recordedMimeType = 'audio/ogg;codecs=opus';

    const file = await recordClip([new Blob(['opus'])]);

    expect(file.type).toBe('audio/ogg');
    expect(file.name).toMatch(/\.ogg$/);
  });

  it('releases the microphone once the recording stops', async () => {
    await recordClip([new Blob(['chunk'])]);

    expect(trackStopMock).toHaveBeenCalledTimes(2);
  });

  it('releases the microphone when the browser cannot create a recorder', async () => {
    const unsupported = new DOMException('unsupported', 'NotSupportedError');
    stubRecorder(
      class {
        mimeType = '';
        ondataavailable = null;
        onstop = null;
        constructor() {
          throw unsupported;
        }
      },
    );

    await expect(recordMicrophoneToFile(vi.fn())).rejects.toBe(unsupported);
    expect(trackStopMock).toHaveBeenCalledTimes(2);
  });
});
