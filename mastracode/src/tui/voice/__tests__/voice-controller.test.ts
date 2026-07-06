import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { VoiceSettings } from '../../../onboarding/settings.js';
import type { STTEngine, STTSession, STTSessionCallbacks } from '../engines/types.js';

const mocks = vi.hoisted(() => ({
  createSTTEngine: vi.fn(),
}));

vi.mock('../engines/index.js', () => ({
  createSTTEngine: mocks.createSTTEngine,
}));

import { VoiceController } from '../voice-controller.js';

/** A controllable fake engine + session for driving the controller in tests. */
function makeFakeEngine(checkReadyResult: string | null = null) {
  let captured: STTSessionCallbacks | null = null;
  const stop = vi.fn(async () => {});
  const cancel = vi.fn();
  const session: STTSession = { stop, cancel };
  const engine: STTEngine = {
    kind: 'cloud',
    checkReady: vi.fn(() => checkReadyResult),
    start: vi.fn((cb: STTSessionCallbacks) => {
      captured = cb;
      return session;
    }),
  };
  return {
    engine,
    session,
    stop,
    cancel,
    emitPartial: (t: string) => captured?.onPartial(t),
    emitFinal: (t: string) => captured?.onFinal(t),
    emitError: (e: Error) => captured?.onError(e),
  };
}

const SETTINGS: VoiceSettings = { enabled: false, engine: 'cloud', provider: 'openai', model: 'whisper-1' };

function makeController(opts?: { live?: boolean; checkReady?: string | null }) {
  const fake = makeFakeEngine(opts?.checkReady ?? null);
  mocks.createSTTEngine.mockReturnValue(fake.engine);
  const onTranscript = vi.fn();
  const onPartialTranscript = opts?.live ? vi.fn() : undefined;
  const showInfo = vi.fn();
  const showError = vi.fn();
  const controller = new VoiceController({
    settings: SETTINGS,
    onTranscript,
    onPartialTranscript,
    showInfo,
    showError,
  });
  return { controller, fake, onTranscript, onPartialTranscript, showInfo, showError };
}

describe('VoiceController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enables when the engine reports ready', () => {
    const { controller, showInfo } = makeController();
    expect(controller.enable()).toBe(true);
    expect(controller.isEnabled()).toBe(true);
    expect(showInfo).toHaveBeenCalled();
  });

  it('refuses to enable when the engine is not ready', () => {
    const { controller, showError } = makeController({ checkReady: 'needs a recorder' });
    expect(controller.enable()).toBe(false);
    expect(controller.isEnabled()).toBe(false);
    expect(showError).toHaveBeenCalledWith('needs a recorder');
  });

  it('toggles between enabled and disabled', () => {
    const { controller } = makeController();
    expect(controller.toggle()).toBe(true);
    expect(controller.toggle()).toBe(false);
    expect(controller.isEnabled()).toBe(false);
  });

  it('ignores startRecording while disabled', () => {
    const { controller, fake } = makeController();
    controller.startRecording();
    expect(controller.isRecording()).toBe(false);
    expect(fake.engine.start).not.toHaveBeenCalled();
  });

  it('records and streams the final transcript word-by-word (non-live)', async () => {
    const { controller, fake, onTranscript } = makeController();
    controller.enable();

    controller.startRecording();
    expect(controller.isRecording()).toBe(true);

    const stopped = controller.stopRecording();
    fake.emitFinal('hello world');
    await stopped;
    // streamTranscript feeds chunks with small delays; wait for it to drain.
    await new Promise(r => setTimeout(r, 100));

    const streamed = onTranscript.mock.calls.map(call => call[0]).join('');
    expect(streamed).toBe('hello world');
    expect(controller.getState()).toBe('idle');
  });

  it('reports an engine error via showError', async () => {
    const { controller, fake, showError } = makeController();
    controller.enable();
    controller.startRecording();

    fake.emitError(new Error('boom'));
    await Promise.resolve();

    expect(showError).toHaveBeenCalledWith('boom');
  });

  it('appends permission fix steps when the engine explains a blocked permission', async () => {
    const { controller, fake, showError } = makeController();
    // Engine can describe a blocked permission with concrete steps.
    (fake.engine as { permissions?: () => Promise<unknown> }).permissions = vi.fn(async () => ({
      state: 'blocked',
      summary: 'Microphone access is turned off for your terminal.',
      steps: ['Open System Settings › Privacy & Security › Microphone.', 'Turn it on, then restart the terminal.'],
    }));
    controller.enable();
    controller.startRecording();

    fake.emitError(new Error('permission denied'));
    await Promise.resolve();
    await Promise.resolve();

    expect(showError).toHaveBeenCalledWith(expect.stringContaining('Microphone access is turned off'));
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('1. Open System Settings'));
  });

  it('does not dress a session error with will-prompt guidance', async () => {
    const { controller, fake, showError } = makeController();
    // A not-yet-determined state is not the reason a session failed, so it must
    // not replace the real error with a "macOS will prompt next time" message.
    (fake.engine as { permissions?: () => Promise<unknown> }).permissions = vi.fn(async () => ({
      state: 'will-prompt',
      summary: "macOS hasn't asked for access yet — it will prompt the first time you dictate.",
      steps: ['Hold the space bar and start speaking.', 'Click Allow when macOS asks.'],
    }));
    controller.enable();
    controller.startRecording();

    fake.emitError(new Error('recognizer stopped before it could start'));
    await Promise.resolve();
    await Promise.resolve();

    expect(showError).toHaveBeenCalledWith('recognizer stopped before it could start');
    expect(showError).not.toHaveBeenCalledWith(expect.stringContaining('will prompt'));
  });

  it('shows a hint when the final transcript is empty (non-live)', async () => {
    const { controller, fake, showInfo, onTranscript } = makeController();
    controller.enable();
    controller.startRecording();

    const stopped = controller.stopRecording();
    fake.emitFinal('');
    await stopped;

    expect(onTranscript).not.toHaveBeenCalled();
    expect(showInfo).toHaveBeenCalledWith('No speech detected.');
  });

  it('streams live partials and replaces with the final on stop (live)', async () => {
    const { controller, fake, onPartialTranscript, onTranscript } = makeController({ live: true });
    controller.enable();
    controller.startRecording();

    fake.emitPartial('hello');
    expect(onPartialTranscript).toHaveBeenCalledWith('hello');

    const stopped = controller.stopRecording();
    fake.emitFinal('hello world');
    await stopped;

    expect(onPartialTranscript).toHaveBeenLastCalledWith('hello world');
    expect(onTranscript).not.toHaveBeenCalled();
    expect(controller.getState()).toBe('idle');
  });

  it('cancels an in-progress session on disable', () => {
    const { controller, fake } = makeController();
    controller.enable();
    controller.startRecording();
    controller.disable();
    expect(fake.cancel).toHaveBeenCalledTimes(1);
    expect(controller.isRecording()).toBe(false);
  });

  it('reconfigure rebuilds the engine and re-validates when enabled', () => {
    const { controller, showError } = makeController();
    controller.enable();
    expect(controller.isEnabled()).toBe(true);

    // Next engine reports not-ready; reconfigure should disable + surface it.
    const next = makeFakeEngine('macOS native only on macOS');
    mocks.createSTTEngine.mockReturnValue(next.engine);
    controller.reconfigure({ ...SETTINGS, engine: 'macos-native' });

    expect(controller.isEnabled()).toBe(false);
    expect(showError).toHaveBeenCalledWith('macOS native only on macOS');
  });

  it('verifyReady prefers the engine async verify() when present', async () => {
    const { controller, fake } = makeController();
    (fake.engine as STTEngine).verify = vi.fn(async () => 'swiftc not installed');
    await expect(controller.verifyReady()).resolves.toBe('swiftc not installed');
    expect(fake.engine.verify).toHaveBeenCalledTimes(1);
    expect(fake.engine.checkReady).not.toHaveBeenCalled();
  });

  it('verifyReady falls back to checkReady() when no async verify exists', async () => {
    const { controller, fake } = makeController({ checkReady: 'needs a recorder' });
    expect(fake.engine.verify).toBeUndefined();
    await expect(controller.verifyReady()).resolves.toBe('needs a recorder');
  });
});
