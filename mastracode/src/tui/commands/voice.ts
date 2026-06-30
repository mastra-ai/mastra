import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import type { VoiceEngine, VoiceSettings } from '../../onboarding/settings.js';
import { askModalQuestion } from '../modal-question.js';
import type { PermissionGuidance } from '../voice/engines/types.js';
import { openMacSettings } from '../voice/native/open-settings.js';
import { defaultModelForProvider, resolveSTTModel, sttModelsForProvider, sttProviders } from '../voice/stt-registry.js';
import { hasProviderCredential } from '../voice/transcribe.js';
import type { SlashCommandContext } from './types.js';

/**
 * `/voice` — manage push-to-talk voice input.
 *
 * Subcommands:
 *   /voice            Interactive menu (toggle / engine / provider / model / status)
 *   /voice on|off     Quick toggle (back-compat)
 *   /voice status     Print the current engine, provider/model, and readiness
 */
export async function handleVoiceCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  const controller = ctx.state.voiceController;
  if (!controller) {
    ctx.showError('Voice input is unavailable.');
    return;
  }

  const arg = args[0]?.toLowerCase();
  if (arg === 'on' || arg === 'off') {
    await setEnabled(ctx, arg === 'on');
    return;
  }
  if (arg === 'status') {
    await showStatus(ctx);
    return;
  }

  await runMenu(ctx);
}

/** Persist a settings patch and re-apply it to the live controller. */
function applyVoiceSettings(ctx: SlashCommandContext, patch: Partial<VoiceSettings>): VoiceSettings {
  const settings = loadSettings();
  settings.voice = { ...settings.voice, ...patch };
  try {
    saveSettings(settings);
  } catch {
    // Persisting is best-effort; the in-session change still applies.
  }
  ctx.state.voiceController?.reconfigure(settings.voice);
  return settings.voice;
}

async function setEnabled(ctx: SlashCommandContext, enable: boolean): Promise<void> {
  const controller = ctx.state.voiceController!;
  const currentlyEnabled = controller.isEnabled();
  if (enable === currentlyEnabled) {
    ctx.showInfo(`Voice input is already ${enable ? 'on' : 'off'}.`);
    return;
  }
  const nowEnabled = controller.toggle();
  applyVoiceSettings(ctx, { enabled: nowEnabled });
  // After turning voice on, proactively walk the user through any permissions
  // the active engine needs — don't make them discover the requirement by
  // failing to dictate.
  if (nowEnabled) await guidePermissions(ctx);
}

/**
 * Check the active engine's permission state and guide the user through fixing
 * it. For macOS native this means offering to open the exact Privacy & Security
 * pane when access is blocked, or explaining the first-run prompt when it isn't
 * granted yet. No-op for engines that need no permissions (cloud).
 */
async function guidePermissions(ctx: SlashCommandContext): Promise<void> {
  const controller = ctx.state.voiceController;
  const guidance = await controller?.permissionGuidance();
  if (!guidance || guidance.state === 'ok') return;
  await presentGuidance(ctx, guidance);
}

async function presentGuidance(ctx: SlashCommandContext, guidance: PermissionGuidance): Promise<void> {
  const lines = [guidance.summary, ...(guidance.steps ?? []).map((step, i) => `  ${i + 1}. ${step}`)];

  // When we can jump straight to the right settings pane, offer to do it.
  if (guidance.settingsUrl && process.platform === 'darwin') {
    const open = guidance.actionLabel ?? 'Open System Settings';
    const choice = await askModalQuestion(ctx.state.ui, {
      question: lines.join('\n'),
      options: [
        { label: open, description: 'Opens the exact settings pane for you' },
        { label: 'Not now', description: "I'll do it later" },
      ],
    });
    if (choice === open) {
      const opened = await openMacSettings(guidance.settingsUrl);
      ctx.showInfo(
        opened
          ? 'Opened System Settings. Turn on the toggle for your terminal, then fully quit and reopen it.'
          : `Open this URL to fix it: ${guidance.settingsUrl}`,
      );
    }
    return;
  }

  // No actionable deep link (e.g. will prompt on first use) — just explain.
  ctx.showInfo(lines.join('\n'));
}

function describeReadiness(voice: VoiceSettings): string {
  if (voice.engine === 'macos-native') {
    return process.platform === 'darwin'
      ? 'macOS native (on-device). First use prompts for Speech Recognition + Microphone access.'
      : 'macOS native is only available on macOS — switch to a cloud provider.';
  }
  const entry = resolveSTTModel(voice.provider, voice.model);
  const hasKey = hasProviderCredential(entry.provider);
  const keyNote = hasKey ? 'API key found.' : `No API key for ${entry.provider} — add one via /api-keys.`;
  return `cloud · ${entry.provider}/${entry.model} (${entry.label}). ${keyNote}`;
}

/** Short engine label for the status header. */
function engineLabel(voice: VoiceSettings): string {
  if (voice.engine === 'macos-native') return 'macOS native (on-device)';
  const entry = resolveSTTModel(voice.provider, voice.model);
  return `cloud · ${entry.provider}/${entry.model}`;
}

async function showStatus(ctx: SlashCommandContext): Promise<void> {
  const voice = loadSettings().voice;
  const enabled = ctx.state.voiceController?.isEnabled() ? 'on' : 'off';

  const lines = [`Voice input: ${enabled}`, `  Engine:  ${engineLabel(voice)}`];

  if (voice.engine === 'cloud') {
    const entry = resolveSTTModel(voice.provider, voice.model);
    lines.push(`  API key: ${hasProviderCredential(entry.provider) ? 'found' : `missing — add one via /api-keys`}`);
  }

  // Deeper async preflight (e.g. native permission/toolchain probe) when the
  // engine supports it, so /voice status reports real readiness, not a static hint.
  const problem = await ctx.state.voiceController?.verifyReady();
  if (problem) {
    lines.push(`  Status:  ⚠ action needed`, ...problem.split('\n').map(l => `           ${l}`));
  } else if (voice.engine === 'macos-native') {
    lines.push(`  Status:  ✓ ready — hold space to dictate (macOS may prompt on first use)`);
  } else {
    lines.push(`  Status:  ✓ ready — hold space to dictate`);
  }

  ctx.showInfo(lines.join('\n'));
}

async function runMenu(ctx: SlashCommandContext): Promise<void> {
  const voice = loadSettings().voice;
  const enabled = ctx.state.voiceController?.isEnabled() ?? voice.enabled;

  const choice = await askModalQuestion(ctx.state.ui, {
    question: 'Voice input settings',
    options: [
      { label: enabled ? 'Turn off' : 'Turn on', description: 'Toggle push-to-talk voice input' },
      { label: 'Engine', description: `Currently: ${voice.engine}` },
      { label: 'Provider', description: `Cloud provider (currently: ${voice.provider})` },
      { label: 'Model', description: `Cloud model (currently: ${voice.model ?? 'default'})` },
      { label: 'Status', description: 'Show engine, provider/model, and readiness' },
    ],
  });
  if (!choice) return;

  switch (choice) {
    case enabled ? 'Turn off' : 'Turn on':
      await setEnabled(ctx, !enabled);
      return;
    case 'Engine':
      await chooseEngine(ctx);
      return;
    case 'Provider':
      await chooseProvider(ctx);
      return;
    case 'Model':
      await chooseModel(ctx);
      return;
    case 'Status':
      await showStatus(ctx);
      return;
  }
}

async function chooseEngine(ctx: SlashCommandContext): Promise<void> {
  const macOption = process.platform === 'darwin' ? 'macOS native (on-device)' : 'macOS native (macOS only)';
  const choice = await askModalQuestion(ctx.state.ui, {
    question: 'Choose STT engine',
    options: [
      { label: macOption, description: 'Free, offline, low-latency. Requires macOS.' },
      { label: 'Cloud provider', description: 'Use a cloud transcription provider.' },
    ],
  });
  if (!choice) return;

  const engine: VoiceEngine = choice.startsWith('macOS') ? 'macos-native' : 'cloud';
  if (engine === 'macos-native' && process.platform !== 'darwin') {
    ctx.showError('macOS native STT is only available on macOS. Pick a cloud provider instead.');
    return;
  }
  const voice = applyVoiceSettings(ctx, { engine });
  ctx.showInfo(`Voice engine set to ${engine}. ${describeReadiness(voice)}`);
  // If they switched to the native engine while voice is on, guide permissions now.
  if (engine === 'macos-native' && ctx.state.voiceController?.isEnabled()) {
    await guidePermissions(ctx);
  }
}

async function chooseProvider(ctx: SlashCommandContext): Promise<void> {
  const providers = sttProviders();
  const choice = await askModalQuestion(ctx.state.ui, {
    question: 'Choose cloud STT provider',
    options: providers.map(provider => {
      const def = defaultModelForProvider(provider);
      return { label: provider, description: def ? def.label : undefined };
    }),
  });
  if (!choice) return;

  // Switching provider resets the model to that provider's default.
  const def = defaultModelForProvider(choice);
  const voice = applyVoiceSettings(ctx, { engine: 'cloud', provider: choice, model: def?.model });
  ctx.showInfo(`Voice provider set to ${choice}. ${describeReadiness(voice)}`);
}

async function chooseModel(ctx: SlashCommandContext): Promise<void> {
  const voice = loadSettings().voice;
  const models = sttModelsForProvider(voice.provider);
  if (models.length === 0) {
    ctx.showError(`No STT models known for provider ${voice.provider}. Pick a provider first.`);
    return;
  }
  const choice = await askModalQuestion(ctx.state.ui, {
    question: `Choose model for ${voice.provider}`,
    options: models.map(m => ({ label: m.model, description: m.label })),
  });
  if (!choice) return;

  const updated = applyVoiceSettings(ctx, { engine: 'cloud', model: choice });
  ctx.showInfo(`Voice model set to ${updated.model}. ${describeReadiness(updated)}`);
}
