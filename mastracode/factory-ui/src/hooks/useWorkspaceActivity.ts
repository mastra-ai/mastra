import type { AgentControllerThreadInfo } from '@mastra/client-js';
import { useQueries } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../ui/domains/chat/services/agentControllerClient';

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
  worktreePaths: string[];
  baseUrl?: string;
  enabled: boolean;
}

/**
 * The shared thread listing behind the workspace hooks. Factory sessions are
 * provisioned with their own session id as the memory resourceId (see
 * FactoryStartCoordinator.prepare), so one resource-scoped poll from a page
 * cannot see other rows' threads. Instead each worktree row is polled as its
 * own resource via the passive listing — which never gets-or-creates a server
 * session, so polling from the Board never brings a cold session online. The
 * ambient resourceId is also polled to cover legacy `projectPath`-keyed
 * personal worktree threads that live under the page's own resource.
 */
function useWorkspaceThreadsQuery({
  agentControllerId,
  resourceId,
  worktreePaths,
  baseUrl,
  enabled,
}: WorkspaceActivityOptions): AgentControllerThreadInfo[] {
  const resourceIds = [...new Set([resourceId, ...worktreePaths])].filter(Boolean);
  const queries = useQueries({
    queries: resourceIds.map(id => ({
      queryKey: queryKeys.agentControllerActivity(agentControllerId, id),
      queryFn: async () => {
        const { controller } = createAgentControllerClient({
          agentControllerId,
          resourceId: id,
          baseUrl,
        });
        if (!controller) throw new Error('Agent controller client is not available');
        return controller.listResourceThreads(id);
      },
      enabled,
      refetchInterval: WORKSPACE_ACTIVITY_POLL_MS,
      retry: false,
    })),
  });
  return queries.flatMap(query => query.data ?? []);
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
    const thread = conversationThread(threads.filter(t => isWorkspaceThread(t, path)));
    const title = thread?.title?.trim();
    if (title) titles[path] = title;
  }
  return titles;
}
