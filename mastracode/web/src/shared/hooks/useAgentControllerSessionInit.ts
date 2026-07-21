import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../../web/ui/domains/chat/services/agentControllerClient';

interface UseAgentControllerSessionInitArgs {
  agentControllerId: string;
  resourceId: string;
  projectPath?: string;
  projectState?: Record<string, unknown>;
  baseUrl?: string;
  enabled?: boolean;
}

export function useAgentControllerSessionInit({
  agentControllerId,
  resourceId,
  projectPath,
  projectState,
  baseUrl = '',
  enabled = true,
}: UseAgentControllerSessionInitArgs) {
  const { session } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled,
  });

  return useQuery({
    queryKey: [
      ...queryKeys.agentControllerConnection(agentControllerId, resourceId, projectPath),
      'init',
      projectState,
    ],
    queryFn: async () => {
      const activeSession = requireAgentControllerSession(session);
      const created = await activeSession.create({ tags: projectPath ? { projectPath } : undefined });
      if (projectPath) {
        try {
          await activeSession.setState({ projectPath, ...projectState });
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
