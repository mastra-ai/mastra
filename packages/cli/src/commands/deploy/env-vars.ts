import { isSecretPlaceholder } from '../env/platform-api.js';

/**
 * Given the env vars already stored on the target environment and the env
 * vars the CLI is about to send, returns the keys whose stored value would be
 * overwritten with a different value. Keys that are new, or whose value is
 * unchanged, are not reported (they aren't destructive overwrites).
 *
 * Incoming write-only secret placeholders are skipped because the platform
 * keeps the stored value. A real value replacing a stored (hidden) secret is
 * reported: the values can't be compared, so it may be an overwrite.
 */
export function getOverwrittenEnvKeys(
  existing: Record<string, string> | null | undefined,
  incoming: Record<string, string>,
): string[] {
  if (!existing) return [];
  return Object.keys(incoming)
    .filter(key => key in existing && existing[key] !== incoming[key] && !isSecretPlaceholder(incoming[key]))
    .sort((a, b) => a.localeCompare(b));
}
