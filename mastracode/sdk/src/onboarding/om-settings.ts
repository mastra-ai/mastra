/**
 * Pure `GlobalSettings` mutation helpers for observational-memory (OM)
 * configuration. Shared by the TUI `/om` command and the web settings
 * routes — no UI dependencies.
 */
import type { OMPack } from './packs.js';
import type { GlobalSettings } from './settings.js';
import { loadSettings, saveSettings } from './settings.js';

/** Whether the user has already chosen any persisted OM model or pack. */
export function hasExplicitOMConfiguration(settings: GlobalSettings): boolean {
  const {
    activeOmPackId,
    omModelOverride,
    observerModelOverride,
    observerModelSelection,
    reflectorModelOverride,
    reflectorModelSelection,
  } = settings.models;
  if (
    omModelOverride ||
    observerModelOverride ||
    (observerModelSelection && observerModelSelection !== 'auto') ||
    reflectorModelOverride ||
    (reflectorModelSelection && reflectorModelSelection !== 'auto')
  ) {
    return true;
  }

  // 'custom' without a model is what onboarding persists when no provider was
  // reachable — a forced non-choice, not a preference worth preserving.
  return [settings.onboarding.omPackId, activeOmPackId].some(packId => packId && packId !== 'custom');
}

/** Seed a built-in OM pack unless the user already chose one; true when settings changed. */
export function applyOMDefaultIfUnconfigured(settings: GlobalSettings, pack: OMPack): boolean {
  if (hasExplicitOMConfiguration(settings)) return false;

  settings.onboarding.omPackId = pack.id;
  settings.models.activeOmPackId = pack.id;
  settings.models.omModelOverride = null;
  return true;
}

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
  _otherRoleCurrentModelId?: string | null,
): void {
  if (role === 'observer') {
    settings.models.observerModelOverride = modelId;
    settings.models.observerModelSelection = modelId;
  } else {
    settings.models.reflectorModelOverride = modelId;
    settings.models.reflectorModelSelection = modelId;
  }

  settings.models.activeOmPackId = 'custom';
}

/** Reset one persisted OM role to dynamic auto selection without touching the other role. */
export function applyOmRoleAuto(settings: GlobalSettings, role: 'observer' | 'reflector'): void {
  if (role === 'observer') {
    settings.models.observerModelOverride = null;
    settings.models.observerModelSelection = 'auto';
  } else {
    settings.models.reflectorModelOverride = null;
    settings.models.reflectorModelSelection = 'auto';
  }

  settings.models.activeOmPackId = 'custom';
}

export function persistOmObserveAttachments(value: 'auto' | boolean): void {
  const settings = loadSettings();
  settings.models.omObserveAttachments = value;
  saveSettings(settings);
}
