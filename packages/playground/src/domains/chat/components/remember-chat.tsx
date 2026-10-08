import { useMastraClient } from '@mastra/react';
import { isAuthenticated, useAuthCapabilities } from '@mastra/react/hooks/auth';
import { useEffect } from 'react';
import { chatHistoryKey, rememberChat } from '../utils/chat-history';

/** Only actual conversations update history; inspecting or editing an agent never changes it. */
export function RememberChat({ agentId, threadId }: { agentId: string; threadId: string }) {
  const client = useMastraClient();
  const { data: auth } = useAuthCapabilities();
  const authenticated = auth && isAuthenticated(auth);
  const allowed = auth?.enabled === false || authenticated;
  const userId = authenticated ? auth.user.id : undefined;
  const key = chatHistoryKey(client.options.baseUrl, client.options.apiPrefix, userId);
  useEffect(() => {
    if (allowed) rememberChat(key, { agentId, threadId });
  }, [allowed, key, agentId, threadId]);
  return null;
}
