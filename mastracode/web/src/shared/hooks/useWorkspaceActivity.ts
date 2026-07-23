import type { AgentControllerThreadInfo } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../../web/ui/domains/chat/services/agentControllerClient';

/** How often workspace activity is re-checked while the tab is focused. */
export const WORKSPACE_ACTIVITY_POLL_MS = 5000;

function isActiveWorkspaceThread(thread: AgentControllerThreadInfo, projectPath: string): boolean {
  return thread.tags?.projectPath === projectPath && 'state' in thread && thread.state === 'active';
}

interface WorkspaceActivityOptions {
  agentControllerId: string;
  resourceId: string;
  /** Session scope for the listing read — the active worktree's project path. */
  scope: string | undefined;
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
  scope,
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
        scope,
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
 * A worktree's conversation thread: the most recent *titled* thread, falling
 * back to the most recent thread of any kind. Bringing a session online can
 * seed an empty untitled thread whose `updatedAt` sorts newer than the real
 * conversation, so recency alone is not a reliable signal — titled threads win
 * regardless of age. Both the sidebar row label and its navigation target use
 * this rule so they can never point at different threads.
 */
export function conversationThread<T extends { title?: string | null; updatedAt?: string; createdAt?: string }>(
  threads: T[],
): T | undefined {
  const sorted = [...threads].sort((a, b) =>
    (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''),
  );
  return sorted.find(thread => thread.title?.trim()) ?? sorted[0];
}

/**
 * Maps each worktree to its conversation thread's title. A factory worktree
 * holds a single conversation, so this is the session's display name; paths
 * with no titled thread yet are omitted (callers fall back to the branch).
 */
export function useWorkspaceThreadTitles(options: WorkspaceActivityOptions): Record<string, string> {
  const threads = useWorkspaceThreadsQuery(options);
  const titles: Record<string, string> = {};
  for (const path of options.worktreePaths) {
    const thread = conversationThread(threads.filter(t => t.tags?.projectPath === path));
    const title = thread?.title?.trim();
    if (title) titles[path] = title;
  }
  return titles;
}

/**
 * Maps each worktree to its conversation thread's id, resolved from the same
 * poll that feeds the sidebar. Lets a row navigate straight to its thread
 * without blocking on a session create + thread listing first; paths with no
 * thread yet are omitted so callers can fall back to the worktree's own id
 * (the seeded thread shares that id — see FactoryStartCoordinator.prepare).
 */
export function useWorkspaceConversationThreadIds(options: WorkspaceActivityOptions): Record<string, string> {
  const threads = useWorkspaceThreadsQuery(options);
  const ids: Record<string, string> = {};
  for (const path of options.worktreePaths) {
    const thread = conversationThread(threads.filter(t => t.tags?.projectPath === path));
    if (thread?.id) ids[path] = thread.id;
  }
  return ids;
}
