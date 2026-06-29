import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SlashCommandContext } from '../types.js';
import { handleVoiceCommand } from '../voice.js';

const voiceMocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock('../../../onboarding/settings.js', () => ({
  loadSettings: voiceMocks.loadSettings,
  saveSettings: voiceMocks.saveSettings,
}));

function createContext(opts: { controller?: { toggle: () => boolean } | undefined; storedEnabled?: boolean }) {
  const settings = { voice: { enabled: opts.storedEnabled ?? false } };
  voiceMocks.loadSettings.mockReturnValue(settings);
  const showError = vi.fn();
  const ctx = {
    state: { voiceController: opts.controller },
    showError,
  } as unknown as SlashCommandContext;
  return { ctx, settings, showError };
}

describe('handleVoiceCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when no controller is available', () => {
    const { ctx, showError } = createContext({ controller: undefined });
    handleVoiceCommand(ctx);
    expect(showError).toHaveBeenCalledWith('Voice input is unavailable.');
    expect(voiceMocks.saveSettings).not.toHaveBeenCalled();
  });

  it('persists enabled=true when toggling on', () => {
    const controller = { toggle: vi.fn(() => true) };
    const { ctx, settings } = createContext({ controller, storedEnabled: false });
    handleVoiceCommand(ctx);
    expect(controller.toggle).toHaveBeenCalled();
    expect(settings.voice.enabled).toBe(true);
    expect(voiceMocks.saveSettings).toHaveBeenCalledWith(settings);
  });

  it('persists enabled=false when toggling off', () => {
    const controller = { toggle: vi.fn(() => false) };
    const { ctx, settings } = createContext({ controller, storedEnabled: true });
    handleVoiceCommand(ctx);
    expect(settings.voice.enabled).toBe(false);
    expect(voiceMocks.saveSettings).toHaveBeenCalledWith(settings);
  });

  it('does not re-save when stored state already matches', () => {
    const controller = { toggle: vi.fn(() => true) };
    const { ctx } = createContext({ controller, storedEnabled: true });
    handleVoiceCommand(ctx);
    expect(voiceMocks.saveSettings).not.toHaveBeenCalled();
  });

  it('swallows persistence errors so the in-session toggle still applies', () => {
    const controller = { toggle: vi.fn(() => true) };
    const { ctx } = createContext({ controller, storedEnabled: false });
    voiceMocks.saveSettings.mockImplementation(() => {
      throw new Error('disk full');
    });
    expect(() => handleVoiceCommand(ctx)).not.toThrow();
    expect(controller.toggle).toHaveBeenCalled();
  });
});
