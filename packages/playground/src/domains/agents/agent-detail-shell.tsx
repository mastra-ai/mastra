import { Outlet, useParams } from 'react-router';
import { AgentLayout } from './agent-layout';
import { AgentNavigation } from './components/agent-navigation';
import { AgentNavigationSlot } from './components/agent-navigation-slot';
import { useAgentWorkspace } from './context/agent-workspace-context';
import { AgentWorkspaceProvider } from './context/agent-workspace-provider';
import { useThreadsPanel } from './context/use-threads-panel';
import { FeatureShell } from '@/components/feature-shell';
import { useIsAgentChat } from '@/domains/chat/hooks/use-is-agent-chat';

/** One full-height workspace across Chat, Editor and Traces. */
export function AgentDetailShell() {
  const { agentId } = useParams();
  if (!agentId) return null;
  return (
    <AgentWorkspaceProvider key={agentId}>
      <AgentDetailWorkspace agentId={agentId} />
    </AgentWorkspaceProvider>
  );
}

function AgentDetailWorkspace({ agentId }: { agentId: string }) {
  const workspace = useAgentWorkspace();
  const navigation = useThreadsPanel();
  const isChat = useIsAgentChat();
  return (
    <FeatureShell
      navigationId={`agent:${agentId}`}
      label="Agent navigation"
      navigationRef={handle => navigation?.registerPanel(handle, true)}
      navigationPanelRef={workspace?.navigationPanel}
      sidebar={
        <AgentNavigation agentId={agentId}>
          <AgentNavigationSlot />
        </AgentNavigation>
      }
    >
      <AgentLayout key={isChat ? 'chat' : 'agent'}>
        <Outlet />
      </AgentLayout>
    </FeatureShell>
  );
}
