import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useMastraClient } from '@mastra/react';
import { useAgents } from '@mastra/react/hooks/agents';
import { isAuthenticated, useAuthCapabilities } from '@mastra/react/hooks/auth';
import { useParams } from 'react-router';
import { chatHistoryKey, readChatHistory } from '../utils/chat-history';
import { ResumeAgentChat } from './resume-agent-chat';

export function ChatLanding() {
  const { agentId } = useParams();
  const client = useMastraClient();
  const { data: agents, isLoading, error } = useAgents();
  const { data: auth, error: authError } = useAuthCapabilities();
  if (error || authError)
    return <EmptyState tone="error" titleSlot="Could not load chats" descriptionSlot="Please try again." />;
  if (isLoading || !auth) return <Spinner aria-label="Loading chats" />;
  if (auth.enabled && !isAuthenticated(auth)) return <EmptyState titleSlot="Sign in to open your chats" />;
  if (!agents || Object.keys(agents).length === 0)
    return (
      <EmptyState
        titleSlot="No agents available"
        descriptionSlot="Add an agent to your project to start a conversation."
      />
    );
  const userId = isAuthenticated(auth) ? auth.user.id : undefined;
  const history = readChatHistory(chatHistoryKey(client.options.baseUrl, client.options.apiPrefix, userId));
  const saved = history.find(entry => agents[entry.agentId] && (!agentId || entry.agentId === agentId));
  const selectedAgent = agentId ?? saved?.agentId ?? Object.keys(agents)[0];
  if (!selectedAgent || !agents[selectedAgent])
    return <EmptyState titleSlot="Agent unavailable" descriptionSlot="Choose another agent from Chat." />;
  return <ResumeAgentChat key={selectedAgent} agentId={selectedAgent} threadId={saved?.threadId} />;
}
