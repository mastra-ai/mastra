import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import type { SlashCommandContext } from './types.js';

export function handleVoiceCommand(ctx: SlashCommandContext): void {
  const controller = ctx.state.voiceController;
  if (!controller) {
    ctx.showError('Voice input is unavailable.');
    return;
  }
  const enabled = controller.toggle();
  try {
    const settings = loadSettings();
    if (settings.voice.enabled !== enabled) {
      settings.voice.enabled = enabled;
      saveSettings(settings);
    }
  } catch {
    // Persisting the preference is best-effort; the in-session toggle still applies.
  }
}
