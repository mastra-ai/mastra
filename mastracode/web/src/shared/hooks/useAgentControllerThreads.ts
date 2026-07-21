import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../../web/ui/domains/chat/services/agentControllerClient';

export const AGENT_CONTROLLER_THREAD_PAGE_SIZE = 20;

interface UseAgentControllerThreadsArgs {
  agentControllerId: string;
  resourceId: string;
  /**
   * Session scope. Callers whose local variable is the worktree project path
   * pass it in as `scope: worktreeProjectPath` — the value is also filtered
   * against the server-side `projectPath` tag so lists stay per-worktree.
   */
  scope?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerThreads({
  agentControllerId,
  resourceId,
  scope,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerThreadsArgs) {
  const { session } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: queryKeys.agentControllerThreads(agentControllerId, resourceId, scope),
    queryFn: () =>
      session!.listThreads({
        limit: AGENT_CONTROLLER_THREAD_PAGE_SIZE,
        tags: scope ? { projectPath: scope } : undefined,
      }),
    enabled: enabled && Boolean(session),
  });
}
