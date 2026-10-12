import { cleanProviderId } from '@mastra/playground-ui/domains/llm';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { KeyboardScope } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import { useAgent } from '@mastra/react/hooks/agents';
import { Outlet, useParams } from 'react-router';
import { AgentListNavigation } from './components/agent-navigation';
import { AgentShortcuts } from './components/agent-shortcuts';
import { ThreadsPanelShortcuts } from './components/threads-panel-shortcuts';
import { PlaygroundModelProvider } from './context/playground-model-context';
import { ThreadsPanelProvider } from './context/threads-panel-context';
import { FeatureNavigationContent } from '@/components/feature-navigation-content';

/** Shared agent scope; child routes compose the navigation appropriate to their view. */
export function AgentShell() {
  const { agentId } = useParams();
  const { data: agent } = useAgent({
    agentId: agentId!,
    requestContext: useEntityRequestContext('agent', agentId!)[0],
    queryOptions: { enabled: Boolean(agentId) },
  });
  const defaultProvider = cleanProviderId(agent?.provider ?? '');
  const defaultModel = agent?.modelId ?? '';

  return (
    <FeatureNavigationContent
      navigationId="agents"
      label="Agent navigation"
      sidebar={<AgentListNavigation agentId={agentId!} />}
    >
      <PlaygroundModelProvider key={agentId} defaultProvider={defaultProvider} defaultModel={defaultModel}>
        <KeyboardScope>
          <AgentShortcuts agentId={agentId!} />
          <ThreadsPanelProvider key={agentId}>
            <ThreadsPanelShortcuts />
            <Outlet />
          </ThreadsPanelProvider>
        </KeyboardScope>
      </PlaygroundModelProvider>
    </FeatureNavigationContent>
  );
}
