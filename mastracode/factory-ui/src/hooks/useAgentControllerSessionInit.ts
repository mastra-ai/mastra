import { useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import type { FactorySessionState } from '../ui/domains/chat/context/ChatSessionContext';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';
import { isSessionThreadConflict } from './useAgentControllerSessionSync';

interface UseAgentControllerSessionInitArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  sessionThreadId?: string;
  initialThreadId?: string;
  factorySessionState?: FactorySessionState;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerSessionInit({
  agentControllerId,
  resourceId,
  scope,
  sessionThreadId,
  initialThreadId,
  factorySessionState,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerSessionInitArgs) {
  const queryClient = useQueryClient();
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
      initialThreadId ?? null,
    ],
    queryFn: async () => {
      const activeSession = requireAgentControllerSession(session);
      let threadId: string | null;
      const openingExistingThread = initialThreadId !== undefined && initialThreadId !== sessionThreadId;
      if (openingExistingThread) {
        try {
          await activeSession.state({ threadId: initialThreadId });
        } catch (error) {
          if (!isSessionThreadConflict(error)) throw error;
          await activeSession.switchThread(initialThreadId);
        }
        threadId = initialThreadId;
      } else {
        const created = await activeSession.create({
          tags: scope ? { projectPath: scope } : undefined,
          threadId: sessionThreadId,
        });
        threadId = created.threadId ?? null;
      }
      if (scope || factorySessionState) {
        try {
          await activeSession.setState({ ...(scope ? { projectPath: scope } : {}), ...factorySessionState });
        } catch {
          // Continue connecting; session.state() remains the source of truth.
        }
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerConnectionState(
          agentControllerId,
          resourceId,
          scope,
          initialThreadId ?? sessionThreadId,
        ),
        exact: true,
      });
      return { threadId };
    },
    enabled: enabled && Boolean(session),
    staleTime: Infinity,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}
