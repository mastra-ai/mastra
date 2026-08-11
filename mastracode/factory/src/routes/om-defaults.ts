import { resolveBuiltinProviderOMModelId } from '@mastra/code-sdk/onboarding/packs';

import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';

/**
 * Seed a caller's observational-memory models from the provider they just
 * connected, filling only knobs still unset. Providers with no low-cost
 * built-in OM pack are skipped: leaving OM unset beats pinning observation and
 * reflection to a full-size coding model.
 */
export async function fillProviderOMDefaults({
  memorySettings,
  orgId,
  userId,
  providerId,
}: {
  memorySettings: MemorySettingsStorage | undefined;
  orgId: string;
  userId: string;
  providerId: string;
}): Promise<void> {
  if (!memorySettings) return;
  const modelId = resolveBuiltinProviderOMModelId(providerId);
  if (!modelId) return;
  try {
    await memorySettings.ensureReady();
    await memorySettings.patch({
      orgId,
      userId,
      patch: {},
      fillIfUnset: { observerModelId: modelId, reflectorModelId: modelId },
    });
  } catch {
    // The credential is already persisted; an unreachable settings row must not fail the connect.
  }
}
