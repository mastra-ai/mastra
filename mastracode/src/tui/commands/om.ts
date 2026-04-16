import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import { OMSettingsComponent } from '../components/om-settings.js';
import { promptForApiKeyIfNeeded } from '../prompt-api-key.js';
import type { SlashCommandContext } from './types.js';

function persistOmModelOverride(modelId: string): void {
  const settings = loadSettings();
  settings.models.activeOmPackId = 'custom';
  settings.models.omModelOverride = modelId;
  saveSettings(settings);
}

function persistOmThresholds({
  observationThreshold,
  reflectionThreshold,
}: {
  observationThreshold?: number;
  reflectionThreshold?: number;
}): void {
  const settings = loadSettings();
  if (observationThreshold !== undefined) {
    settings.models.omObservationThreshold = observationThreshold;
  }
  if (reflectionThreshold !== undefined) {
    settings.models.omReflectionThreshold = reflectionThreshold;
  }
  saveSettings(settings);
}

export async function handleOMCommand(ctx: SlashCommandContext): Promise<void> {
  const availableModels = await ctx.state.harness.listAvailableModels();
  const modelById = new Map(availableModels.map(model => [model.id, model] as const));
  const modelOptions = availableModels.map(m => ({
    id: m.id,
    label: m.id,
  }));

  const ensureApiKeyForModel = async (modelId: string) => {
    const model = modelById.get(modelId);
    if (!model) return;
    await promptForApiKeyIfNeeded(ctx.state.ui, model, ctx.authStorage);
  };

  const config = {
    observerModelId: ctx.state.harness.getObserverModelId() ?? '',
    reflectorModelId: ctx.state.harness.getReflectorModelId() ?? '',
    observationThreshold: ctx.state.harness.getObservationThreshold() ?? 30_000,
    reflectionThreshold: ctx.state.harness.getReflectionThreshold() ?? 40_000,
  };

  return new Promise<void>(resolve => {
    const settings = new OMSettingsComponent(
      config,
      {
        onObserverModelChange: async modelId => {
          await ensureApiKeyForModel(modelId);
          await ctx.state.harness.switchObserverModel({ modelId });
          persistOmModelOverride(modelId);
          ctx.showInfo(`Observer model → ${modelId}`);
        },
        onReflectorModelChange: async modelId => {
          await ensureApiKeyForModel(modelId);
          await ctx.state.harness.switchReflectorModel({ modelId });
          persistOmModelOverride(modelId);
          ctx.showInfo(`Reflector model → ${modelId}`);
        },
        onObservationThresholdChange: async value => {
          await ctx.state.harness.setState({ observationThreshold: value } as any);
          await ctx.state.harness.setThreadSetting({ key: 'observationThreshold', value });
          persistOmThresholds({ observationThreshold: value });
        },
        onReflectionThresholdChange: async value => {
          await ctx.state.harness.setState({ reflectionThreshold: value } as any);
          await ctx.state.harness.setThreadSetting({ key: 'reflectionThreshold', value });
          persistOmThresholds({ reflectionThreshold: value });
        },
        onClose: () => {
          ctx.state.ui.hideOverlay();
          ctx.updateStatusLine();
          resolve();
        },
      },
      modelOptions,
      ctx.state.ui,
    );

    ctx.state.ui.showOverlay(settings, {
      width: '80%',
      maxHeight: '70%',
      anchor: 'center',
    });
    settings.focused = true;
  });
}
