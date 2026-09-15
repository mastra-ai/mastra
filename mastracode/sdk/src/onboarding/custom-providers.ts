/**
 * Pure `GlobalSettings` mutation helpers for custom OpenAI-compatible
 * providers. Shared by the TUI `/custom-providers` command and the web
 * settings routes — no UI dependencies.
 */
import { getCustomProviderId } from './settings.js';
import type { CustomProviderSetting, GlobalSettings } from './settings.js';

function normalizeProvider(input: CustomProviderSetting): CustomProviderSetting {
  return {
    name: input.name.trim(),
    url: input.url.trim(),
    apiKey: input.apiKey?.trim() || undefined,
    models: [...new Set(input.models.map(model => model.trim()).filter(Boolean))],
  };
}

export function upsertCustomProviderInSettings(
  settings: GlobalSettings,
  provider: CustomProviderSetting,
  previousProviderId?: string,
): void {
  const next = normalizeProvider(provider);
  const nextProviderId = getCustomProviderId(next.name);
  const filteredProviders = settings.customProviders.filter(existing => {
    const id = getCustomProviderId(existing.name);
    return id !== nextProviderId && (!previousProviderId || id !== previousProviderId);
  });
  settings.customProviders = [...filteredProviders, next];
}

export function removeCustomProviderFromSettings(settings: GlobalSettings, providerId: string): void {
  settings.customProviders = settings.customProviders.filter(
    provider => getCustomProviderId(provider.name) !== providerId,
  );
}
