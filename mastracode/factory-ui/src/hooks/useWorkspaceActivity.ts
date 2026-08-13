import type { AgentControllerThreadInfo } from '@mastra/client-js';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';

/** How often workspace activity is re-checked while the tab is focused. */
export const WORKSPACE_ACTIVITY_POLL_MS = 5000;

/**
 * Whether a thread belongs to a given workspace row.
 *
 * Rows are keyed differently depending on where they come from, so both keys
 * are accepted. Factory sessions are stamped with `factorySessionId` (the
 * session id, which is also the sidebar row key) by
 * `FactoryStartCoordinator.configureThread`. Personal/local worktree sessions
 * predate that and are keyed by their `projectPath` — which now holds the
 * sandbox workdir path rather than the session id, so it can no longer be
 * relied on alone for factory rows.
 */
function isWorkspaceThread(thread: AgentControllerThreadInfo, key: string): boolean {
  return thread.tags?.factorySessionId === key || thread.tags?.projectPath === key;
}

function isActiveWorkspaceThread(thread: AgentControllerThreadInfo, key: string): boolean {
  return isWorkspaceThread(thread, key) && 'state' in thread && thread.state === 'active';
}

interface WorkspaceActivityOptions {
  agentControllerId: string;
  resourceId: string;
  workspaceIds: string[];
  baseUrl?: string;
  enabled: boolean;
}

/** Fetches every visible workspace from one stable aggregate query. */
function useWorkspaceThreadsQuery({
  agentControllerId,
  resourceId,
  workspaceIds,
  baseUrl,
  enabled,
}: WorkspaceActivityOptions): AgentControllerThreadInfo[] {
  const query = useQuery({
    queryKey: queryKeys.agentControllerActivity(agentControllerId, workspaceIds),
    queryFn: async () => {
      const { session } = createAgentControllerClient({
        agentControllerId,
        resourceId,
        baseUrl,
      });
      return requireAgentControllerSession(session).listThreads({ resourceIds: workspaceIds });
    },
    enabled: enabled && workspaceIds.length > 0,
    refetchInterval: WORKSPACE_ACTIVITY_POLL_MS,
    retry: false,
    // A workspace appearing or leaving changes the query key; without a
    // placeholder the swap would read as every run flipping idle for one
    // render and fire completion sounds.
    placeholderData: keepPreviousData,
  });
  return query.data ?? [];
}

/** Reports which workspaces have an agent run in flight, from a single thread listing. */
export function useWorkspaceActivity(options: WorkspaceActivityOptions): Record<string, boolean> {
  const threads = useWorkspaceThreadsQuery(options);
  return Object.fromEntries(
    options.workspaceIds.map(path => [path, threads.some(thread => isActiveWorkspaceThread(thread, path))]),
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
  for (const path of options.workspaceIds) {
    const thread = conversationThread(threads.filter(t => isWorkspaceThread(t, path)));
    const title = thread?.title?.trim();
    if (title) titles[path] = title;
  }
  return titles;
}
