import type { ReactNode } from 'react';
import { useMatch } from 'react-router';
import { AgentNavigationLayout } from './agent-navigation-layout';
import { AgentRecentChats } from './agent-recent-chats';
import { AgentSidebarActivity } from './agent-sidebar-activity';
import { AgentViewNavigation } from './agent-view-navigation';
import { RecentAgents } from './recent-agents';
import { useIsAgentChat } from '@/domains/chat/hooks/use-is-agent-chat';

/** Every agent view shares the same navigation header; only its working sections change. */
export function AgentNavigation({ agentId, children }: { agentId: string; children?: ReactNode }) {
  const isEditor = Boolean(useMatch('/agents/:agentId/editor'));
  const isChat = useIsAgentChat();
  return (
    <AgentNavigationLayout
      recentAgents={<RecentAgents agentId={agentId} view={isChat ? 'chat' : 'agent'} />}
      views={isChat ? undefined : <AgentViewNavigation agentId={agentId} />}
    >
      {!isChat && !isEditor && <AgentRecentChats agentId={agentId} />}
      {children}
      {!isChat && !isEditor && <AgentSidebarActivity agentId={agentId} />}
    </AgentNavigationLayout>
  );
}
