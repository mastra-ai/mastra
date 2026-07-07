/**
 * Pure `GlobalSettings` mutation helpers for observational-memory (OM)
 * configuration. Shared by the TUI `/om` command and the web settings
 * routes — no UI dependencies.
 */
import type { GlobalSettings } from './settings.js';
import { loadSettings, saveSettings } from './settings.js';

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

export function persistOmObserveAttachments(value: 'auto' | boolean): void {
  const settings = loadSettings();
  settings.models.omObserveAttachments = value;
  saveSettings(settings);
}
