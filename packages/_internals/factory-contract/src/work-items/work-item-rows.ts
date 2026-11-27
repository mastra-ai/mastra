export type WorkItemProvider =
  | 'github'
  | 'gitlab'
  | 'jira'
  | 'linear'
  | 'slack'
  | 'incidentio'
  | 'factory'
  | (string & {});

export type WorkItemSourceRole = 'origin' | 'attached';

export interface WorkItemSourceRow {
  id: string;
  workItemId: string;
  provider: WorkItemProvider;
  integrationId: string;
  sourceType: string;
  workspaceId: string | null;
  externalId: string;
  sourceKey: string | null;
  key: string | null;
  url: string | null;
  state: string | null;
  labels: string[];
  author: string | null;
  metadata: Record<string, unknown> | null;
  revision: number;
  syncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function primarySource(card: { workItem: { sources: readonly WorkItemSourceRow[] } }): WorkItemSourceRow | null {
  return card.workItem.sources[0] ?? null;
}

export interface WorkItemRow {
  sources: WorkItemSourceRow[];
  id: string;
  orgId: string;
  factoryProjectId: string;
  provider: WorkItemProvider;
  externalId: string;
  key: string | null;
  url: string | null;
  title: string;
  state: string | null;
  labels: string[];
  author: string | null;
  parentWorkItemId: string | null;
  metadata: Record<string, unknown> | null;
  revision: number;
  syncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
