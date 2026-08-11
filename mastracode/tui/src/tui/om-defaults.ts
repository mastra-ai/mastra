import { applyOMDefaultIfUnconfigured } from '@mastra/code-sdk/onboarding/om-settings';
import type { OMPack } from '@mastra/code-sdk/onboarding/packs';
import { resolveProviderOMDefault } from '@mastra/code-sdk/onboarding/packs';
import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import type { TUIState } from './state.js';

/** Point both live OM roles at one model, without pinning it to the current thread. */
export async function applyOMModelToSession(state: TUIState, modelId: string): Promise<void> {
  await state.session.state.set({ observerModelId: modelId, reflectorModelId: modelId });
}

/** Seed OM from a provider login, preserving explicit settings; undefined when nothing was seeded. */
export async function applyProviderOMDefaultIfUnconfigured(
  state: TUIState,
  providerId: string,
): Promise<OMPack | undefined> {
  const pack = resolveProviderOMDefault(providerId);
  // No cheap OM pack for this provider — leave OM open for a later login rather
  // than pinning observation and reflection to a full-size coding model.
  if (pack.id === 'custom') return undefined;

  const settings = loadSettings();
  if (!applyOMDefaultIfUnconfigured(settings, pack)) return undefined;

  saveSettings(settings);
  await applyOMModelToSession(state, pack.modelId);
  return pack;
}

// Never rejects: runs after the login success message, and the login .catch would
// report a settings failure as an authentication failure.
export async function seedOMDefaultAfterLogin(
  state: TUIState,
  providerId: string,
  showInfo: (message: string) => void,
): Promise<void> {
  try {
    const pack = await applyProviderOMDefaultIfUnconfigured(state, providerId);
    if (pack) showInfo(`Observational memory - switched to ${pack.modelId}`);
  } catch (error) {
    showInfo(`Observational memory default unchanged: ${error instanceof Error ? error.message : String(error)}`);
  }
}
