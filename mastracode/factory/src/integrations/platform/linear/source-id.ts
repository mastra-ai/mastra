/**
 * Intake source ids for Platform Linear. Each one names a Linear workspace and
 * a project or team in it, so the same id keeps resolving whichever Platform
 * connection serves the workspace.
 */

const PROJECT_SOURCE_PREFIX = 'linear-project:';
const TEAM_SOURCE_PREFIX = 'linear-team:';

export function encodeSourceId(workspaceId: string, projectId: string): string {
  return `${PROJECT_SOURCE_PREFIX}${Buffer.from(JSON.stringify({ workspaceId, projectId })).toString('base64url')}`;
}

function decodeSourceId(sourceId: string): { workspaceId: string; projectId: string } {
  if (!sourceId.startsWith(PROJECT_SOURCE_PREFIX)) throw new Error('Linear project source id is invalid.');
  try {
    const parsed = JSON.parse(
      Buffer.from(sourceId.slice(PROJECT_SOURCE_PREFIX.length), 'base64url').toString('utf8'),
    ) as {
      workspaceId?: unknown;
      projectId?: unknown;
    };
    if (typeof parsed.workspaceId !== 'string' || !parsed.workspaceId) throw new Error();
    if (typeof parsed.projectId !== 'string' || !parsed.projectId) throw new Error();
    return { workspaceId: parsed.workspaceId, projectId: parsed.projectId };
  } catch {
    throw new Error('Linear project source id is invalid.');
  }
}

export function encodeTeamSourceId(workspaceId: string, teamId: string): string {
  return `${TEAM_SOURCE_PREFIX}${Buffer.from(JSON.stringify({ workspaceId, teamId })).toString('base64url')}`;
}

export function decodeTeamSourceId(sourceId: string): { workspaceId: string; teamId: string } {
  if (!sourceId.startsWith(TEAM_SOURCE_PREFIX)) throw new Error('Linear team source id is invalid.');
  try {
    const parsed = JSON.parse(Buffer.from(sourceId.slice(TEAM_SOURCE_PREFIX.length), 'base64url').toString('utf8')) as {
      workspaceId?: unknown;
      teamId?: unknown;
    };
    if (typeof parsed.workspaceId !== 'string' || !parsed.workspaceId) throw new Error();
    if (typeof parsed.teamId !== 'string' || !parsed.teamId) throw new Error();
    return { workspaceId: parsed.workspaceId, teamId: parsed.teamId };
  } catch {
    throw new Error('Linear team source id is invalid.');
  }
}

/**
 * A decoded intake source: either a Linear project or a whole Linear team.
 * Downstream code discriminates on `kind` to build the right issue-listing
 * filter and to apply most-specific-wins routing (project beats team).
 */
export type DecodedSource =
  { kind: 'project'; workspaceId: string; projectId: string } | { kind: 'team'; workspaceId: string; teamId: string };

/** Discriminate any Linear source id by its prefix and decode it. */
export function parseSourceId(sourceId: string): DecodedSource {
  if (sourceId.startsWith(TEAM_SOURCE_PREFIX)) {
    return { kind: 'team', ...decodeTeamSourceId(sourceId) };
  }
  return { kind: 'project', ...decodeSourceId(sourceId) };
}
