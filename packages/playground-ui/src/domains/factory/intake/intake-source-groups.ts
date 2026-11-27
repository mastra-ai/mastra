import type { SourcePickerGroup } from './intake-source-picker';

export interface JiraProjectSource {
  id: string;
  name: string;
  key: string;
  site?: string | null;
  connectionId?: string | null;
}

export interface GitLabProjectSource {
  id: string;
  name: string;
  accountLabel?: string | null;
  connectionId?: string | null;
}

export function groupJiraProjectsBySite(projects: JiraProjectSource[]): SourcePickerGroup[] {
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

export function groupGitLabProjectsByAccount(projects: GitLabProjectSource[]): SourcePickerGroup[] {
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
