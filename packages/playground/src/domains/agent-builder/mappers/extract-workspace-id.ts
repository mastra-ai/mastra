import type { StoredAgent } from '@/domains/agents/hooks/use-stored-agents';

export function extractWorkspaceId(workspace: StoredAgent['workspace']): string | undefined {
  if (
    workspace &&
    typeof workspace === 'object' &&
    'type' in workspace &&
    (workspace as { type: string }).type === 'id'
  ) {
    const id = (workspace as { workspaceId?: unknown }).workspaceId;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}
