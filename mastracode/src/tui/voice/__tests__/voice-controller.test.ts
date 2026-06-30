import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  detectRecorder: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
  snapshot: vi.fn(),
  MicRecording: vi.fn(),
  resolveOpenAIApiKey: vi.fn(),
  transcribeAudio: vi.fn(),
}));

vi.mock('../mic-capture.js', () => ({
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

vi.mock('../transcribe.js', () => ({
  resolveOpenAIApiKey: mocks.resolveOpenAIApiKey,
  transcribeAudio: mocks.transcribeAudio,
  VoiceCredentialError: class extends Error {
    constructor() {
      super('needs an OpenAI API key');
    }
  },
}));

import { VoiceController } from '../voice-controller.js';

function makeController() {
  const onTranscript = vi.fn();
  const showInfo = vi.fn();
  const showError = vi.fn();
  const controller = new VoiceController({ onTranscript, showInfo, showError });
  return { controller, onTranscript, showInfo, showError };
}

describe('VoiceController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.detectRecorder.mockReturnValue({ kind: 'sox', bin: 'rec' });
    mocks.resolveOpenAIApiKey.mockReturnValue('sk-test');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enables when a recorder and credentials are available', () => {
    const { controller, showInfo } = makeController();
    expect(controller.enable()).toBe(true);
    expect(controller.isEnabled()).toBe(true);
    expect(showInfo).toHaveBeenCalled();
  });

  it('refuses to enable when no recorder is installed', () => {
    mocks.detectRecorder.mockReturnValue(null);
    const { controller, showError } = makeController();
    expect(controller.enable()).toBe(false);
    expect(controller.isEnabled()).toBe(false);
    expect(showError).toHaveBeenCalled();
  });

  it('refuses to enable when no OpenAI credential is available', () => {
    mocks.resolveOpenAIApiKey.mockReturnValue(undefined);
    const { controller, showError } = makeController();
    expect(controller.enable()).toBe(false);
    expect(showError).toHaveBeenCalled();
  });

  it('toggles between enabled and disabled', () => {
    const { controller } = makeController();
    expect(controller.toggle()).toBe(true);
    expect(controller.toggle()).toBe(false);
    expect(controller.isEnabled()).toBe(false);
  });

  it('ignores startRecording while disabled', () => {
    const { controller } = makeController();
    controller.startRecording();
    expect(controller.isRecording()).toBe(false);
    expect(mocks.MicRecording).not.toHaveBeenCalled();
  });

  it('records, transcribes, and emits the transcript', async () => {
    mocks.stop.mockResolvedValue(Buffer.from('audio'));
    mocks.transcribeAudio.mockResolvedValue('hello world');
    const { controller, onTranscript } = makeController();
    controller.enable();

    controller.startRecording();
    expect(controller.isRecording()).toBe(true);

    await controller.stopRecording();

    expect(mocks.transcribeAudio).toHaveBeenCalledTimes(1);
    // The transcript streams in word-by-word; chunks recombine to the full text.
    const streamed = onTranscript.mock.calls.map(call => call[0]).join('');
    expect(streamed).toBe('hello world');
    expect(controller.getState()).toBe('idle');
  });

  it('reports an error and returns to idle when transcription fails', async () => {
    mocks.stop.mockResolvedValue(Buffer.from('audio'));
    mocks.transcribeAudio.mockRejectedValue(new Error('boom'));
    const { controller, onTranscript, showError } = makeController();
    controller.enable();
    controller.startRecording();

    await controller.stopRecording();

    expect(onTranscript).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith('boom');
    expect(controller.getState()).toBe('idle');
  });

  it('does not transcribe when no audio was captured', async () => {
    mocks.stop.mockResolvedValue(null);
    const { controller, onTranscript, showError } = makeController();
    controller.enable();
    controller.startRecording();

    await controller.stopRecording();

    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
    expect(onTranscript).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalled();
  });

  it('streams live partial transcripts while recording and replaces with the final on stop', async () => {
    vi.useFakeTimers();
    mocks.snapshot.mockReturnValue(Buffer.from('partial-audio'));
    mocks.stop.mockResolvedValue(Buffer.from('full-audio'));
    // First the live tick resolves a partial, then the final stop resolves the full text.
    mocks.transcribeAudio.mockResolvedValueOnce('hello').mockResolvedValueOnce('hello world');

    const onTranscript = vi.fn();
    const onPartialTranscript = vi.fn();
    const showInfo = vi.fn();
    const showError = vi.fn();
    const controller = new VoiceController({ onTranscript, onPartialTranscript, showInfo, showError });
    controller.enable();
    controller.startRecording();

    // Advance past the live interval and flush the async tick.
    await vi.advanceTimersByTimeAsync(2000);
    expect(mocks.snapshot).toHaveBeenCalled();
    expect(onPartialTranscript).toHaveBeenCalledWith('hello');

    vi.useRealTimers();
    await controller.stopRecording();

    // Final transcript replaces the live partial (no word-by-word streaming in live mode).
    expect(onPartialTranscript).toHaveBeenLastCalledWith('hello world');
    expect(onTranscript).not.toHaveBeenCalled();
    expect(controller.getState()).toBe('idle');
  });

  it('cancels an in-progress recording on disable', () => {
    const { controller } = makeController();
    controller.enable();
    controller.startRecording();
    controller.disable();
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
    expect(controller.isRecording()).toBe(false);
  });
});
