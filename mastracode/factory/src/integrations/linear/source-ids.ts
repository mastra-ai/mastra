/**
 * Self-managed source ids. Projects use their raw Linear project id (no prefix,
 * preserving existing intake bindings). Teams are prefixed so the two never
 * collide and callers can tell them apart.
 */
const SELF_MANAGED_TEAM_SOURCE_PREFIX = 'linear-team:';

export function encodeSelfManagedTeamSourceId(teamId: string): string {
  return `${SELF_MANAGED_TEAM_SOURCE_PREFIX}${teamId}`;
}

export function isSelfManagedTeamSourceId(sourceId: string): boolean {
  return sourceId.startsWith(SELF_MANAGED_TEAM_SOURCE_PREFIX);
}

export function decodeSelfManagedTeamSourceId(sourceId: string): string {
  return sourceId.slice(SELF_MANAGED_TEAM_SOURCE_PREFIX.length);
}
