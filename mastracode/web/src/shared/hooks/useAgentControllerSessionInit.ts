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
  /**
   * The session's conventional thread id (=== its sessionId for factory and
   * user workspaces). When set, session creation is an exact-thread
   * get-or-create: it binds the existing thread or (re)creates it with this
   * id, healing sessions whose thread provisioning was interrupted or whose
   * backing storage was reset. Without it, a missing thread would silently
   * bind the session to a fresh random-id thread the route can never load.
   */
  sessionThreadId?: string;
  factorySessionState?: FactorySessionState;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerSessionInit({
  agentControllerId,
  resourceId,
  scope,
  sessionThreadId,
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
      sessionThreadId ?? null,
    ],
    queryFn: async () => {
      const activeSession = requireAgentControllerSession(session);
      const created = await activeSession.create({
        tags: scope ? { projectPath: scope } : undefined,
        threadId: sessionThreadId,
      });
      // Factory sessions have no scope but still need their state seeded —
      // server-side gates (the transition tool, factory-phase processor)
      // resolve the session address from `factoryProjectId` in state.
      if (scope || factorySessionState) {
        try {
          await activeSession.setState({ ...(scope ? { projectPath: scope } : {}), ...factorySessionState });
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
