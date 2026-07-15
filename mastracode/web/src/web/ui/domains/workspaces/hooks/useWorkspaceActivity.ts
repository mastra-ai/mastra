import type { AgentControllerThreadInfo } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';

/** How often workspace activity is re-checked while the tab is focused. */
export const WORKSPACE_ACTIVITY_POLL_MS = 5000;

function isActiveWorkspaceThread(thread: AgentControllerThreadInfo, projectPath: string): boolean {
  return thread.tags?.projectPath === projectPath && 'state' in thread && thread.state === 'active';
}

interface WorkspaceActivityOptions {
  agentControllerId: string;
  resourceId: string;
  /** The active worktree's path — the session scope the listing is read through. */
  projectPath: string | undefined;
  worktreePaths: string[];
  baseUrl?: string;
  enabled: boolean;
}

/**
 * The shared resource-wide thread listing behind the workspace hooks. Threads
 * are stamped with their worktree's `projectPath` tag and the server annotates
 * each with its run state (`active`/`idle`), so one poll covers every worktree
 * sharing the resourceId instead of a request per row.
 */
function useWorkspaceThreadsQuery({
  agentControllerId,
  resourceId,
  projectPath,
  baseUrl,
  enabled,
}: Omit<WorkspaceActivityOptions, 'worktreePaths'>): AgentControllerThreadInfo[] {
  const query = useQuery({
    queryKey: queryKeys.agentControllerActivity(agentControllerId, resourceId),
    queryFn: async () => {
      // A thread listing spans the whole resource regardless of session scope,
      // so read through the already-live active-worktree session rather than
      // seeding a new one.
      const { session } = createAgentControllerClient({
        agentControllerId,
        resourceId,
        scope: projectPath,
        baseUrl,
      });
      return requireAgentControllerSession(session).listThreads();
    },
    enabled,
    refetchInterval: WORKSPACE_ACTIVITY_POLL_MS,
    retry: false,
  });
  return query.data ?? [];
}

/** Reports which workspaces have an agent run in flight, from a single thread listing. */
export function useWorkspaceActivity(options: WorkspaceActivityOptions): Record<string, boolean> {
  const threads = useWorkspaceThreadsQuery(options);
  return Object.fromEntries(
    options.worktreePaths.map(path => [path, threads.some(thread => isActiveWorkspaceThread(thread, path))]),
  );
}

/**
 * Maps each worktree to the title of its most recent titled thread. A factory
 * worktree holds a single conversation, so this is the session's display name;
 * paths with no titled thread yet are omitted (callers fall back to the branch).
 */
export function useWorkspaceThreadTitles(options: WorkspaceActivityOptions): Record<string, string> {
  const threads = useWorkspaceThreadsQuery(options);
  const titles: Record<string, string> = {};
  for (const path of options.worktreePaths) {
    const titled = threads
      .filter(thread => thread.tags?.projectPath === path && thread.title?.trim())
      .sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''));
    const title = titled[0]?.title?.trim();
    if (title) titles[path] = title;
  }
  return titles;
}
