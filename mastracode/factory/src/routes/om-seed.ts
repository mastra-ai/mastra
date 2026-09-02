import { resolveProviderOMDefault } from '@mastra/code-sdk/onboarding/packs';

import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';

/**
 * Seed a user's personal observational-memory model from the provider they
 * just signed in with — the web counterpart of the TUI's "OM follows login"
 * onboarding step. Only fills knobs that are still unset, so a user who has
 * already chosen an OM model keeps it. Org-shared credentials and providers
 * without a built-in OM pack (e.g. GitHub Copilot) are skipped: the former
 * has no single user to seed, the latter has no sensible model to seed with.
 */
export async function seedPersonalOmDefaults({
  memorySettings,
  tenant,
  provider,
}: {
  memorySettings: MemorySettingsStorage | undefined;
  tenant: { orgId: string; userId?: string };
  provider: string;
}): Promise<void> {
  if (!memorySettings || !tenant.userId) return;
  const pack = resolveProviderOMDefault(provider);
  if (pack.id === 'custom') return;
  await memorySettings.ensureReady();
  await memorySettings.patch({
    orgId: tenant.orgId,
    userId: tenant.userId,
    patch: {},
    fillIfUnset: { observerModelId: pack.modelId, reflectorModelId: pack.modelId },
  });
}
