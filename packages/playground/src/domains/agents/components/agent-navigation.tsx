import type { ReactNode } from 'react';
import { useMatch } from 'react-router';
import { AgentNavigationHeader } from './agent-navigation-header';
import { AgentNavigationLayout } from './agent-navigation-layout';
import { RememberRecentAgent } from './recent-agents';
import { useIsAgentChat } from '@/domains/chat/hooks/use-is-agent-chat';
import { StudioAreaNavigation } from '@/domains/navigation/components/studio-area-navigation';

function useAgentViewOwnsSidebar() {
  const isEditor = Boolean(useMatch('/agents/:agentId/editor'));
  return useIsAgentChat() || isEditor;
}

/** Owned above the per-agent remounts, so switching agents keeps the list, its scroll and its search. */
export function AgentListNavigation({ agentId }: { agentId: string }) {
  if (useAgentViewOwnsSidebar()) return null;
  return (
    <>
      <RememberRecentAgent agentId={agentId} />
      <StudioAreaNavigation areaId="agents" />
    </>
  );
}

/** Chat and the Editor keep working sections beside the agent. */
export function AgentNavigation({ agentId, children }: { agentId: string; children?: ReactNode }) {
  const isChat = useIsAgentChat();
  if (!useAgentViewOwnsSidebar()) return null;
  return (
    <AgentNavigationLayout
      header={
        <>
          <RememberRecentAgent agentId={agentId} />
          <AgentNavigationHeader agentId={agentId} view={isChat ? 'chat' : 'agent'} />
        </>
      }
    >
      {children}
    </AgentNavigationLayout>
  );
}
