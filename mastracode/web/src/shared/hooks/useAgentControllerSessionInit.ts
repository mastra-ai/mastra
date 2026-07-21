import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import type { FactorySessionState } from '../../web/ui/domains/chat/context/ChatSessionContext';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../../web/ui/domains/chat/services/agentControllerClient';

interface UseAgentControllerSessionInitArgs {
  agentControllerId: string;
  resourceId: string;
  /**
   * Session scope. The Factory feeds its per-worktree project path in here;
   * the same value is also written back into the session as a `projectPath`
   * tag so the server side can round-trip it.
   */
  scope?: string;
  factorySessionState?: FactorySessionState;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerSessionInit({
  agentControllerId,
  resourceId,
  scope,
  factorySessionState,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerSessionInitArgs) {
  const { session } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: [
      ...queryKeys.agentControllerConnection(agentControllerId, resourceId, scope),
      'init',
      factorySessionState,
    ],
    queryFn: async () => {
      const activeSession = requireAgentControllerSession(session);
      const created = await activeSession.create({ tags: scope ? { projectPath: scope } : undefined });
      if (scope) {
        try {
          await activeSession.setState({ projectPath: scope, ...factorySessionState });
        } catch {
          // Continue connecting; session.state() remains the source of truth.
        }
      }
      return { threadId: created.threadId ?? null };
    },
    enabled: enabled && Boolean(session),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}
