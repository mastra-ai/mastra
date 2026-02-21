import { OMSettingsComponent } from '../components/om-settings.js';
import type { SlashCommandContext } from './types.js';

export async function handleOMCommand(ctx: SlashCommandContext): Promise<void> {
  const availableModels = await ctx.state.harness.listAvailableModels();
  const modelOptions = availableModels.map(m => ({
    id: m.id,
    label: m.id,
  }));

  const config = {
    observerModelId: ctx.state.harness.getObserverModelId(),
    reflectorModelId: ctx.state.harness.getReflectorModelId(),
    observationThreshold: ctx.state.harness.getObservationThreshold(),
    reflectionThreshold: ctx.state.harness.getReflectionThreshold(),
  };

  return new Promise<void>(resolve => {
    const settings = new OMSettingsComponent(
      config,
      {
        onObserverModelChange: async modelId => {
          await ctx.state.harness.switchObserverModel({ modelId });
          ctx.showInfo(`Observer model → ${modelId}`);
        },
        onReflectorModelChange: async modelId => {
          await ctx.state.harness.switchReflectorModel({ modelId });
          ctx.showInfo(`Reflector model → ${modelId}`);
        },
        onObservationThresholdChange: value => {
          ctx.state.harness.setState({ observationThreshold: value } as any);
          ctx.state.omProgress.threshold = value;
          ctx.state.omProgress.thresholdPercent = value > 0 ? (ctx.state.omProgress.pendingTokens / value) * 100 : 0;
          ctx.updateStatusLine();
        },
        onReflectionThresholdChange: value => {
          ctx.state.harness.setState({ reflectionThreshold: value } as any);
          ctx.state.omProgress.reflectionThreshold = value;
          ctx.state.omProgress.reflectionThresholdPercent =
            value > 0 ? (ctx.state.omProgress.observationTokens / value) * 100 : 0;
          ctx.updateStatusLine();
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
