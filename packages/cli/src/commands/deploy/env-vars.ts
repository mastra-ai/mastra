/**
 * Given the env vars already stored on the target environment and the env
 * vars the CLI is about to send, returns the keys whose stored value would be
 * overwritten with a different value. Keys that are new, or whose value is
 * unchanged, are not reported (they aren't destructive overwrites).
 */
export function getOverwrittenEnvKeys(
  existing: Record<string, string> | null | undefined,
  incoming: Record<string, string>,
): string[] {
  if (!existing) return [];
  return Object.keys(incoming)
    .filter(key => key in existing && existing[key] !== incoming[key])
    .sort((a, b) => a.localeCompare(b));
}
