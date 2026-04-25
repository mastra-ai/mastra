import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import { OMSettingsComponent } from '../components/om-settings.js';
import { promptForApiKeyIfNeeded } from '../prompt-api-key.js';
import type { SlashCommandContext } from './types.js';

function persistObserverModelOverride(modelId: string): void {
  const settings = loadSettings();
  settings.models.activeOmPackId = 'custom';
  settings.models.observerModelOverride = modelId;
  saveSettings(settings);
}

function persistReflectorModelOverride(modelId: string): void {
  const settings = loadSettings();
  settings.models.activeOmPackId = 'custom';
  settings.models.reflectorModelOverride = modelId;
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
        onObserverModelChange: async model => {
          await promptForApiKeyIfNeeded(ctx.state.ui, model, ctx.authStorage);
          await ctx.state.harness.switchObserverModel({ modelId: model.id });
          persistObserverModelOverride(model.id);
          ctx.showInfo(`Observer model → ${model.id}`);
        },
        onReflectorModelChange: async model => {
          await promptForApiKeyIfNeeded(ctx.state.ui, model, ctx.authStorage);
          await ctx.state.harness.switchReflectorModel({ modelId: model.id });
          persistReflectorModelOverride(model.id);
          ctx.showInfo(`Reflector model → ${model.id}`);
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
      availableModels,
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
