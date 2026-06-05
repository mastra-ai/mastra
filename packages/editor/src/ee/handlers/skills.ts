import type { IdNameEntry } from './types';

/**
 * Resolve attached skills into a `Record<id, true>`. Mirrors how the playground
 * `set-agent-skills` tool stores skills. Infra-agnostic — no workflow ctx.
 */
export function resolveSkills(entries: IdNameEntry[]): Record<string, boolean> {
  const record: Record<string, boolean> = {};
  for (const entry of entries) {
    if (entry && typeof entry.id === 'string' && entry.id.length > 0) {
      record[entry.id] = true;
    }
  }
  return record;
}
