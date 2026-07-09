/**
 * Pure `GlobalSettings` mutation helpers for custom model packs. Shared by the
 * TUI `/models` command and the web settings routes — no UI dependencies.
 */
import type { GlobalSettings } from './settings.js';

export function removeCustomPackFromSettings(settings: GlobalSettings, packId: string): void {
  if (!packId.startsWith('custom:')) return;
  const packName = packId.slice('custom:'.length);
  const removedPack = settings.customModelPacks.find(p => p.name === packName);
  settings.customModelPacks = settings.customModelPacks.filter(p => p.name !== packName);

  const modeDefaultsMatchRemovedPack =
    !!removedPack &&
    settings.models.modeDefaults.plan === removedPack.models.plan &&
    settings.models.modeDefaults.build === removedPack.models.build &&
    settings.models.modeDefaults.fast === removedPack.models.fast;

  if (settings.models.activeModelPackId === packId) {
    settings.models.activeModelPackId = null;
    settings.models.modeDefaults = {};
  } else if (modeDefaultsMatchRemovedPack) {
    settings.models.modeDefaults = {};
  }

  if (settings.onboarding.modePackId === packId) {
    settings.onboarding.modePackId = null;
  }
}
