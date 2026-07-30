import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  detectRecorder: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
  snapshot: vi.fn(),
  MicRecording: vi.fn(),
  transcribe: vi.fn(),
  createTranscriber: vi.fn(),
  hasProviderCredential: vi.fn(),
}));

vi.mock('../../mic-capture.js', () => ({
  detectRecorder: mocks.detectRecorder,
  MicRecording: class {
    constructor(..._args: unknown[]) {
      mocks.MicRecording(..._args);
    }
    stop() {
      return mocks.stop();
    }
    cancel() {
      return mocks.cancel();
    }
    snapshot() {
      return mocks.snapshot();
    }
  },
}));

vi.mock('../../transcribe.js', () => ({
  createTranscriber: mocks.createTranscriber,
  hasProviderCredential: mocks.hasProviderCredential,
}));

import { CloudSTTEngine } from '../cloud-engine.js';

function callbacks() {
  return { onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn() };
}

describe('CloudSTTEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.detectRecorder.mockReturnValue({ kind: 'sox', bin: 'rec' });
    mocks.hasProviderCredential.mockReturnValue(true);
    // createTranscriber returns a reusable transcriber bound to the provider;
    // its transcribe() takes just the audio buffer.
    mocks.createTranscriber.mockReturnValue({ transcribe: mocks.transcribe });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('checkReady passes when recorder and credential exist', () => {
    const engine = new CloudSTTEngine({ provider: 'openai' });
    expect(engine.checkReady()).toBeNull();
  });

  it('checkReady reports a missing recorder', () => {
    mocks.detectRecorder.mockReturnValue(null);
    const engine = new CloudSTTEngine({ provider: 'openai' });
    expect(engine.checkReady()).toMatch(/recorder/i);
  });

  it('checkReady reports a missing API key with the provider env var', () => {
    mocks.hasProviderCredential.mockReturnValue(false);
    const engine = new CloudSTTEngine({ provider: 'groq' });
    expect(engine.checkReady()).toMatch(/GROQ_API_KEY/);
  });

  it('records, transcribes on stop, and emits the final transcript', async () => {
    mocks.stop.mockResolvedValue(Buffer.from('audio'));
    mocks.transcribe.mockResolvedValue('hello world');
    const engine = new CloudSTTEngine({ provider: 'openai', model: 'whisper-1' });
    const cb = callbacks();

    const session = engine.start(cb);
    await session.stop();

    expect(mocks.MicRecording).toHaveBeenCalledTimes(1);
    // The provider client is built once per session and reused across calls.
    expect(mocks.createTranscriber).toHaveBeenCalledTimes(1);
    expect(mocks.createTranscriber).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'openai', model: 'whisper-1' }),
    );
    expect(mocks.transcribe).toHaveBeenCalledWith(Buffer.from('audio'));
    expect(cb.onFinal).toHaveBeenCalledWith('hello world');
  });

  it('emits partial transcripts while recording', async () => {
    vi.useFakeTimers();
    mocks.snapshot.mockReturnValue(Buffer.from('partial-audio'));
    mocks.transcribe.mockResolvedValue('partial text');
    const engine = new CloudSTTEngine({ provider: 'openai' });
    const cb = callbacks();

    engine.start(cb);
    // First partial fires after the initial short delay.
    await vi.advanceTimersByTimeAsync(700);

    expect(cb.onPartial).toHaveBeenCalledWith('partial text');
  });

  it('does not re-emit an unchanged partial transcript', async () => {
    vi.useFakeTimers();
    mocks.snapshot.mockReturnValue(Buffer.from('partial-audio'));
    mocks.transcribe.mockResolvedValue('same text');
    const engine = new CloudSTTEngine({ provider: 'openai' });
    const cb = callbacks();

    engine.start(cb);
    await vi.advanceTimersByTimeAsync(300); // first tick (short initial delay)
    await vi.advanceTimersByTimeAsync(1300); // second tick, identical text

    expect(cb.onPartial).toHaveBeenCalledTimes(1);
    expect(cb.onPartial).toHaveBeenCalledWith('same text');
  });

  it('reports a transcription error via onError', async () => {
    mocks.stop.mockResolvedValue(Buffer.from('audio'));
    mocks.transcribe.mockRejectedValue(new Error('boom'));
    const engine = new CloudSTTEngine({ provider: 'openai' });
    const cb = callbacks();

    const session = engine.start(cb);
    await session.stop();

    expect(cb.onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }));
  });

  it('reuses one transcriber client across live ticks and the final', async () => {
    vi.useFakeTimers();
    mocks.snapshot.mockReturnValue(Buffer.from('partial-audio'));
    mocks.transcribe.mockResolvedValue('partial text');
    mocks.stop.mockResolvedValue(Buffer.from('audio'));
    const engine = new CloudSTTEngine({ provider: 'openai' });
    const cb = callbacks();

    const session = engine.start(cb);
    await vi.advanceTimersByTimeAsync(300); // first tick
    await vi.advanceTimersByTimeAsync(1300); // second tick
    await session.stop();

    // Built exactly once even though transcribe() ran several times.
    expect(mocks.createTranscriber).toHaveBeenCalledTimes(1);
    expect(mocks.transcribe.mock.calls.length).toBeGreaterThan(1);
  });

  it('cancel aborts capture without transcribing', () => {
    const engine = new CloudSTTEngine({ provider: 'openai' });
    const cb = callbacks();
    const session = engine.start(cb);
    session.cancel();
    expect(mocks.cancel).toHaveBeenCalled();
    expect(cb.onFinal).not.toHaveBeenCalled();
  });
});
