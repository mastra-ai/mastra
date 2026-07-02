import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SlashCommandContext } from '../types.js';

const voiceMocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  askModalQuestion: vi.fn(),
  hasProviderCredential: vi.fn(() => true),
  openMacSettings: vi.fn(async () => true),
}));

vi.mock('../../../onboarding/settings.js', () => ({
  loadSettings: voiceMocks.loadSettings,
  saveSettings: voiceMocks.saveSettings,
}));

vi.mock('../../modal-question.js', () => ({
  askModalQuestion: voiceMocks.askModalQuestion,
}));

vi.mock('../../voice/transcribe.js', () => ({
  hasProviderCredential: voiceMocks.hasProviderCredential,
}));

vi.mock('../../voice/native/open-settings.js', () => ({
  openMacSettings: voiceMocks.openMacSettings,
}));

import { handleVoiceCommand } from '../voice.js';

type FakeController = {
  isEnabled: ReturnType<typeof vi.fn>;
  toggle: ReturnType<typeof vi.fn>;
  reconfigure: ReturnType<typeof vi.fn>;
  verifyReady: ReturnType<typeof vi.fn>;
  permissionGuidance: ReturnType<typeof vi.fn>;
};

function createContext(opts: { controller?: FakeController; storedEnabled?: boolean } = {}) {
  const settings = {
    voice: { enabled: opts.storedEnabled ?? false, engine: 'cloud', provider: 'openai', model: 'whisper-1' },
  };
  voiceMocks.loadSettings.mockReturnValue(settings);
  const showError = vi.fn();
  const showInfo = vi.fn();
  const ctx = {
    state: { voiceController: opts.controller, ui: {} },
    showError,
    showInfo,
  } as unknown as SlashCommandContext;
  return { ctx, settings, showError, showInfo };
}

function makeController(enabled: boolean): FakeController {
  let on = enabled;
  return {
    isEnabled: vi.fn(() => on),
    toggle: vi.fn(() => {
      on = !on;
      return on;
    }),
    reconfigure: vi.fn(),
    verifyReady: vi.fn(async () => null),
    // Cloud controller in tests: no native permission guidance.
    permissionGuidance: vi.fn(async () => null),
  };
}

describe('handleVoiceCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    voiceMocks.hasProviderCredential.mockReturnValue(true);
  });

  it('shows an error when no controller is available', async () => {
    const { ctx, showError } = createContext({ controller: undefined });
    await handleVoiceCommand(ctx);
    expect(showError).toHaveBeenCalledWith('Voice input is unavailable.');
    expect(voiceMocks.saveSettings).not.toHaveBeenCalled();
  });

  it('/voice on enables and persists', async () => {
    const controller = makeController(false);
    const { ctx, settings } = createContext({ controller, storedEnabled: false });
    await handleVoiceCommand(ctx, ['on']);
    expect(controller.toggle).toHaveBeenCalled();
    expect(settings.voice.enabled).toBe(true);
    expect(voiceMocks.saveSettings).toHaveBeenCalled();
    expect(controller.reconfigure).toHaveBeenCalled();
  });

  it('/voice on offers to open Settings when the engine reports blocked permissions', async () => {
    const controller = makeController(false);
    controller.permissionGuidance.mockResolvedValue({
      state: 'blocked',
      summary: 'Microphone access is turned off for your terminal.',
      steps: ['Open System Settings › Privacy & Security › Microphone.'],
      settingsUrl: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
      actionLabel: 'Open Microphone settings',
    });
    voiceMocks.askModalQuestion.mockResolvedValue('Open Microphone settings');
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    try {
      const { ctx } = createContext({ controller, storedEnabled: false });
      await handleVoiceCommand(ctx, ['on']);
      expect(controller.permissionGuidance).toHaveBeenCalled();
      expect(voiceMocks.openMacSettings).toHaveBeenCalledWith(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
      );
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    }
  });

  it('/voice on explains the first-run prompt without a modal when permission will prompt', async () => {
    const controller = makeController(false);
    controller.permissionGuidance.mockResolvedValue({
      state: 'will-prompt',
      summary: 'macOS will prompt the first time you dictate.',
      steps: ['Hold space and speak.', 'Click Allow when asked.'],
    });
    const { ctx, showInfo } = createContext({ controller, storedEnabled: false });
    await handleVoiceCommand(ctx, ['on']);
    expect(voiceMocks.askModalQuestion).not.toHaveBeenCalled();
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('macOS will prompt'));
  });

  it('/voice off disables and persists', async () => {
    const controller = makeController(true);
    const { ctx, settings } = createContext({ controller, storedEnabled: true });
    await handleVoiceCommand(ctx, ['off']);
    expect(settings.voice.enabled).toBe(false);
    expect(voiceMocks.saveSettings).toHaveBeenCalled();
  });

  it('/voice on is a no-op when already on', async () => {
    const controller = makeController(true);
    const { ctx, showInfo } = createContext({ controller, storedEnabled: true });
    await handleVoiceCommand(ctx, ['on']);
    expect(controller.toggle).not.toHaveBeenCalled();
    expect(showInfo).toHaveBeenCalledWith('Voice input is already on.');
  });

  it('/voice status reports engine and provider', async () => {
    const controller = makeController(true);
    const { ctx, showInfo } = createContext({ controller, storedEnabled: true });
    await handleVoiceCommand(ctx, ['status']);
    expect(showInfo).toHaveBeenCalledTimes(1);
    const text = showInfo.mock.calls[0][0] as string;
    expect(text).toContain('Voice input: on');
    expect(text).toContain('Engine:');
    expect(text).toContain('openai/whisper-1');
    // Multi-line, labelled layout rather than one long sentence.
    expect(text.split('\n').length).toBeGreaterThan(1);
  });

  it('menu: choosing a provider persists it and resets the model to that default', async () => {
    const controller = makeController(false);
    const { ctx, settings } = createContext({ controller });
    voiceMocks.askModalQuestion.mockResolvedValueOnce('Provider').mockResolvedValueOnce('groq');

    await handleVoiceCommand(ctx);

    expect(settings.voice.provider).toBe('groq');
    expect(settings.voice.model).toBe('whisper-large-v3-turbo');
    expect(controller.reconfigure).toHaveBeenCalled();
  });

  it('menu: choosing macOS engine off-darwin surfaces an error', async () => {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    try {
      const controller = makeController(false);
      const { ctx, showError } = createContext({ controller });
      voiceMocks.askModalQuestion.mockResolvedValueOnce('Engine').mockResolvedValueOnce('macOS native (macOS only)');

      await handleVoiceCommand(ctx);

      expect(showError).toHaveBeenCalledWith(
        'macOS native STT is only available on macOS. Pick a cloud provider instead.',
      );
    } finally {
      Object.defineProperty(process, 'platform', { value: original, configurable: true });
    }
  });

  it('swallows persistence errors so the in-session change still applies', async () => {
    const controller = makeController(false);
    const { ctx } = createContext({ controller, storedEnabled: false });
    voiceMocks.saveSettings.mockImplementation(() => {
      throw new Error('disk full');
    });
    await expect(handleVoiceCommand(ctx, ['on'])).resolves.toBeUndefined();
    expect(controller.toggle).toHaveBeenCalled();
  });
});
