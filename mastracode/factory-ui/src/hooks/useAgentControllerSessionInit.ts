import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import type { FactorySessionState } from '../ui/domains/chat/context/ChatSessionContext';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';

interface UseAgentControllerSessionInitArgs {
  agentControllerId: string;
  sessionId: string;
  /** The memory resource the session runs under: the Factory id or the user's id. */
  resourceId: string;
  /** Tags stamped onto every thread the session creates (`{ factorySessionId }`). */
  threadTags?: Record<string, string>;
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
  sessionId,
  resourceId,
  threadTags,
  sessionThreadId,
  factorySessionState,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerSessionInitArgs) {
  const { session } = createAgentControllerClient({
    agentControllerId,
    sessionId,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: [
      ...queryKeys.agentControllerConnection(agentControllerId, sessionId),
      'init',
      resourceId,
      factorySessionState,
      sessionThreadId ?? null,
    ],
    queryFn: async () => {
      const activeSession = requireAgentControllerSession(session);
      const created = await activeSession.create({
        resourceId,
        tags: threadTags,
        threadId: sessionThreadId,
      });
      // Factory sessions need their state seeded — server-side gates (the
      // transition tool, factory-phase processor) read `factoryProjectId` from state.
      if (factorySessionState) {
        try {
          await activeSession.setState({ ...factorySessionState });
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
