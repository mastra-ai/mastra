import { resolveProviderOMDefault } from '@mastra/code-sdk/onboarding/packs';

import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';

/**
 * Seed a user's personal observational-memory model from the provider they
 * just signed in with — the web counterpart of the TUI's "OM follows login"
 * onboarding step. Only fills knobs that are still unset, so a user who has
 * already chosen an OM model keeps it. Org-shared credentials and providers
 * without a built-in OM pack (e.g. GitHub Copilot) are skipped: the former
 * has no single user to seed, the latter has no sensible model to seed with.
 *
 * Never rejects: it runs after the credential has been persisted, so a
 * memory-settings failure must not turn a successful login or key save into
 * an error response (or leave a completed OAuth session unclaimed).
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
  try {
    await memorySettings.ensureReady();
    await memorySettings.patch({
      orgId: tenant.orgId,
      userId: tenant.userId,
      patch: {},
      fillIfUnset: { observerModelId: pack.modelId, reflectorModelId: pack.modelId },
    });
  } catch (error) {
    console.warn('[factory] Failed to seed personal OM defaults after storing a credential', {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
