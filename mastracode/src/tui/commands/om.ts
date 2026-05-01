import type { GlobalSettings } from '../../onboarding/settings.js';
import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import { OMSettingsComponent } from '../components/om-settings.js';
import { promptForApiKeyIfNeeded } from '../prompt-api-key.js';
import type { SlashCommandContext } from './types.js';

/**
 * Apply a role-specific OM model override to an in-memory `GlobalSettings`.
 *
 * When switching `activeOmPackId` from a built-in pack to `'custom'` we also
 * snapshot the *other* role's currently-resolved model into its override
 * field. Without this, the other role would silently lose its model on next
 * startup because `resolveOmRoleModel` would no longer resolve it from the
 * (now-overridden) pack.
 *
 * Exported for unit testing; `persistOmRoleOverride` is the disk-backed wrapper.
 */
export function applyOmRoleOverride(
  settings: GlobalSettings,
  role: 'observer' | 'reflector',
  modelId: string,
  otherRoleCurrentModelId: string | null,
): void {
  const wasBuiltinPack = settings.models.activeOmPackId !== null && settings.models.activeOmPackId !== 'custom';

  if (role === 'observer') {
    if (wasBuiltinPack && otherRoleCurrentModelId && !settings.models.reflectorModelOverride) {
      settings.models.reflectorModelOverride = otherRoleCurrentModelId;
    }
    settings.models.observerModelOverride = modelId;
  } else {
    if (wasBuiltinPack && otherRoleCurrentModelId && !settings.models.observerModelOverride) {
      settings.models.observerModelOverride = otherRoleCurrentModelId;
    }
    settings.models.reflectorModelOverride = modelId;
  }

  settings.models.activeOmPackId = 'custom';
}

function persistOmRoleOverride(
  role: 'observer' | 'reflector',
  modelId: string,
  otherRoleCurrentModelId: string | null,
): void {
  const settings = loadSettings();
  applyOmRoleOverride(settings, role, modelId, otherRoleCurrentModelId);
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
          const currentReflector = ctx.state.harness.getReflectorModelId() ?? null;
          await ctx.state.harness.switchObserverModel({ modelId: model.id });
          persistOmRoleOverride('observer', model.id, currentReflector);
          ctx.showInfo(`Observer model → ${model.id}`);
        },
        onReflectorModelChange: async model => {
          await promptForApiKeyIfNeeded(ctx.state.ui, model, ctx.authStorage);
          const currentObserver = ctx.state.harness.getObserverModelId() ?? null;
          await ctx.state.harness.switchReflectorModel({ modelId: model.id });
          persistOmRoleOverride('reflector', model.id, currentObserver);
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
