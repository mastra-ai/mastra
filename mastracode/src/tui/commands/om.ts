import type { GlobalSettings } from '../../onboarding/settings.js';
import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import { OMSettingsComponent } from '../components/om-settings.js';
import { showModalOverlay } from '../overlay.js';
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

function persistOmCavemanObservations(enabled: boolean): void {
  const settings = loadSettings();
  settings.models.omCavemanObservations = enabled;
  saveSettings(settings);
}

export function persistOmObserveAttachments(value: 'auto' | boolean): void {
  const settings = loadSettings();
  settings.models.omObserveAttachments = value;
  saveSettings(settings);
}

export async function handleOMCommand(ctx: SlashCommandContext): Promise<void> {
  const availableModels = await ctx.state.harness.listAvailableModels();

  const harnessState = ctx.state.session.state.get() as Record<string, unknown> | undefined;
  const config = {
    observerModelId: ctx.state.session.om.observer.modelId() ?? '',
    reflectorModelId: ctx.state.session.om.reflector.modelId() ?? '',
    observationThreshold: ctx.state.session.om.observer.threshold() ?? 30_000,
    reflectionThreshold: ctx.state.session.om.reflector.threshold() ?? 40_000,
    cavemanObservations: (harnessState?.cavemanObservations as boolean | undefined) ?? false,
    observeAttachments: (harnessState?.observeAttachments as 'auto' | boolean | undefined) ?? 'auto',
  };

  return new Promise<void>(resolve => {
    const settings = new OMSettingsComponent(
      config,
      {
        onObserverModelChange: async model => {
          await promptForApiKeyIfNeeded(ctx.state.ui, model, ctx.authStorage);
          const currentReflector = ctx.state.session.om.reflector.modelId() ?? null;
          await ctx.state.session.om.observer.switchModel({ modelId: model.id });
          persistOmRoleOverride('observer', model.id, currentReflector);
          ctx.showInfo(`Observer model → ${model.id}`);
        },
        onReflectorModelChange: async model => {
          await promptForApiKeyIfNeeded(ctx.state.ui, model, ctx.authStorage);
          const currentObserver = ctx.state.session.om.observer.modelId() ?? null;
          await ctx.state.session.om.reflector.switchModel({ modelId: model.id });
          persistOmRoleOverride('reflector', model.id, currentObserver);
          ctx.showInfo(`Reflector model → ${model.id}`);
        },
        onObservationThresholdChange: async value => {
          await ctx.state.session.state.set({ observationThreshold: value } as any);
          await ctx.state.session.thread.setSetting({ key: 'observationThreshold', value });
          persistOmThresholds({ observationThreshold: value });
        },
        onReflectionThresholdChange: async value => {
          await ctx.state.session.state.set({ reflectionThreshold: value } as any);
          await ctx.state.session.thread.setSetting({ key: 'reflectionThreshold', value });
          persistOmThresholds({ reflectionThreshold: value });
        },
        onCavemanObservationsChange: async enabled => {
          await ctx.state.session.state.set({ cavemanObservations: enabled } as any);
          await ctx.state.session.thread.setSetting({ key: 'cavemanObservations', value: enabled });
          persistOmCavemanObservations(enabled);
          ctx.showInfo(`Caveman observations → ${enabled ? 'on' : 'off'}`);
        },
        onObserveAttachmentsChange: async value => {
          await ctx.state.session.state.set({ observeAttachments: value } as any);
          await ctx.state.session.thread.setSetting({ key: 'observeAttachments', value });
          persistOmObserveAttachments(value);
          const label = value === 'auto' ? 'auto' : value ? 'on' : 'off';
          ctx.showInfo(`Observe attachments → ${label}`);
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

    showModalOverlay(ctx.state.ui, settings, { widthPercent: 0.8, maxHeight: '70%' });
    settings.focused = true;
  });
}
