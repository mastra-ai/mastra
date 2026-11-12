import type { GitLabProject } from '../../factory/services/gitlab';
import type { JiraProject } from '../../factory/services/jira';
import { linearSourceWorkspaceId, linearTeamSourceId } from '../../factory/services/linear';
import type { LinearProject, LinearTeam } from '../../factory/services/linear';
import type { SourcePickerGroup } from './IntakeSourcePicker';

export function groupJiraProjectsBySite(projects: JiraProject[]): SourcePickerGroup[] {
  const byConnection = new Map<string, SourcePickerGroup>();
  for (const project of projects) {
    const site = project.site ?? 'Jira';
    const key = project.connectionId ?? site;
    const group = byConnection.get(key) ?? { id: key, label: site, items: [] };
    group.items.push({ id: project.id, label: project.name, detail: project.key });
    byConnection.set(key, group);
  }
  const groups = [...byConnection.values()].toSorted((left, right) =>
    (left.label ?? '').localeCompare(right.label ?? ''),
  );
  distinguishConnections(groups);
  return groups;
}

export function groupGitLabProjectsByAccount(projects: GitLabProject[]): SourcePickerGroup[] {
  const byAccount = new Map<string, SourcePickerGroup>();
  for (const project of projects) {
    const account = project.accountLabel ?? 'GitLab';
    const key = project.connectionId ?? account;
    const group = byAccount.get(key) ?? { id: key, label: account, items: [] };
    group.items.push({ id: project.id, label: project.name });
    byAccount.set(key, group);
  }
  const groups = [...byAccount.values()].toSorted((left, right) => (left.label ?? '').localeCompare(right.label ?? ''));
  distinguishConnections(groups);
  return groups;
}

function distinguishConnections(groups: SourcePickerGroup[]) {
  const labelCounts = new Map<string, number>();
  for (const group of groups) labelCounts.set(group.label ?? '', (labelCounts.get(group.label ?? '') ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const group of groups) {
    const label = group.label ?? '';
    if ((labelCounts.get(label) ?? 0) > 1) {
      const ordinal = (seen.get(label) ?? 0) + 1;
      seen.set(label, ordinal);
      group.label = `${label} (connection ${ordinal})`;
    }
  }
}

export function groupLinearSourcesByTeam(
  projects: LinearProject[],
  teams: LinearTeam[],
  selectedIds: string[] | null,
): SourcePickerGroup[] {
  const selected = new Set(selectedIds ?? []);
  const teamById = new Map(teams.map(team => [team.id, team]));
  const byTeam = new Map<string, SourcePickerGroup>();
  const orphans: LinearProject[] = [];

  const ensureGroup = (teamId: string, teamName: string): SourcePickerGroup => {
    const existing = byTeam.get(teamId);
    if (existing) return existing;
    // Project metadata lacks the backend's opaque team source ID.
    const team = teamById.get(teamId);
    const group: SourcePickerGroup = {
      id: teamId,
      label: teamName,
      items: team ? [{ id: linearTeamSourceId(team), label: `All issues in ${teamName}` }] : [],
    };
    byTeam.set(teamId, group);
    return group;
  };

  for (const team of teams) ensureGroup(team.id, team.name);

  for (const project of projects) {
    if (project.teams.length === 0) {
      orphans.push(project);
      continue;
    }
    for (const team of project.teams) {
      const group = ensureGroup(team.id, teamById.get(team.id)?.name ?? team.name);
      const knownTeam = teamById.get(team.id);
      const teamSelected = knownTeam ? selected.has(linearTeamSourceId(knownTeam)) : false;
      const projectSelected = selected.has(project.id);
      group.items.push({
        id: project.id,
        label: project.name,
        ...(teamSelected ? { hint: projectSelected ? 'project takes precedence' : 'included via team' } : {}),
      });
    }
  }

  const groups = [...byTeam.values()].sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''));
  if (orphans.length) {
    groups.push({
      id: 'no-team',
      label: 'No team',
      items: orphans.map(project => ({ id: project.id, label: project.name })),
    });
  }
  return groups;
}

export interface DisconnectedLinearWorkspace {
  workspaceId: string;
  sourceIds: string[];
}

/**
 * Split saved Linear sources into ones the picker can show and ones from a
 * workspace that is no longer connected. Connected workspaces are read off the
 * live project and team IDs; a saved ID from any other workspace has no name
 * to show, so it is collapsed into one row per workspace instead.
 */
export function partitionLinearSources(
  selectedIds: string[] | null,
  groups: SourcePickerGroup[],
): { selectedIds: string[]; disconnected: DisconnectedLinearWorkspace[] } {
  const listedIds = new Set(groups.flatMap(group => group.items.map(item => item.id)));
  const connectedWorkspaces = new Set(
    [...listedIds].map(linearSourceWorkspaceId).filter((id): id is string => id !== null),
  );
  const visible: string[] = [];
  const byWorkspace = new Map<string, string[]>();
  for (const id of selectedIds ?? []) {
    const workspaceId = listedIds.has(id) ? null : linearSourceWorkspaceId(id);
    if (workspaceId === null || connectedWorkspaces.has(workspaceId)) {
      visible.push(id);
      continue;
    }
    byWorkspace.set(workspaceId, [...(byWorkspace.get(workspaceId) ?? []), id]);
  }
  return {
    selectedIds: visible,
    disconnected: [...byWorkspace].map(([workspaceId, sourceIds]) => ({ workspaceId, sourceIds })),
  };
}
