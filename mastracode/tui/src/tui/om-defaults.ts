import { PROVIDER_DEFAULT_MODELS } from '@mastra/code-sdk/auth/storage';
import { applyOMDefaultIfUnconfigured } from '@mastra/code-sdk/onboarding/om-settings';
import type { OMPack } from '@mastra/code-sdk/onboarding/packs';
import { resolveProviderOMDefault } from '@mastra/code-sdk/onboarding/packs';
import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import type { TUIState } from './state.js';

/** Apply one OM model to both live roles and persist it on the active thread. */
export async function applyOMModelToSession(state: TUIState, modelId: string): Promise<void> {
  await Promise.all([
    state.session.om.observer.switchModel({ modelId }),
    state.session.om.reflector.switchModel({ modelId }),
  ]);
  await state.session.state.set({ observerModelId: modelId, reflectorModelId: modelId });
}

/**
 * Seed OM from a successful provider login while preserving explicit settings.
 *
 * Returns the applied pack, or undefined when OM was already configured.
 */
export async function applyProviderOMDefaultIfUnconfigured(
  state: TUIState,
  providerId: string,
): Promise<OMPack | undefined> {
  const settings = loadSettings();
  const providerModelId = PROVIDER_DEFAULT_MODELS[providerId];
  const pack = resolveProviderOMDefault(providerId, providerModelId);
  if (!applyOMDefaultIfUnconfigured(settings, pack)) return undefined;

  saveSettings(settings);
  await applyOMModelToSession(state, pack.modelId);
  return pack;
}
