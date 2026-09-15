import { coreFeatures } from '@mastra/core/features';
import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { KeyboardScope } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useParams, useLocation, useNavigate } from 'react-router';
import { AgentDetailHeaderActions } from '@/domains/agents/components/agent-detail-header-actions';
import { AgentOverviewPanel } from '@/domains/agents/components/agent-overview-panel/agent-overview-panel';
import { AgentPageTabs } from '@/domains/agents/components/agent-page-tabs';
import type { AgentPageTab } from '@/domains/agents/components/agent-page-tabs';
import { AgentTopBarRunOptions } from '@/domains/agents/components/agent-top-bar-controls';
import { OverviewPanelShortcuts } from '@/domains/agents/components/overview-panel-shortcuts';
import { ThreadTracesToggle } from '@/domains/agents/components/thread-traces-toggle';
import { ActivatedSkillsProvider } from '@/domains/agents/context/activated-skills-context';
import { PlaygroundModelProvider } from '@/domains/agents/context/playground-model-context';
import { ReviewQueueProvider } from '@/domains/agents/context/review-queue-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useHasObservability } from '@/domains/configuration/hooks/use-has-observability';
import { GenerationProvider } from '@/domains/datasets/context/generation-context';
import { cleanProviderId } from '@/domains/llm/utils';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { RouteSidePanel } from '@/lib/route-side-panel';

/** Shadows the global "go to" sequences with agent-scoped targets while an agent page is mounted. */
const AgentShortcuts = ({ agentId }: { agentId: string }) => {
  const navigate = useNavigate();
  useKeydown({ 'g$+t': () => navigate(`/agents/${agentId}/traces`) });
  return null;
};

export const AgentLayout = ({ children }: { children: React.ReactNode }) => {
  const { agentId } = useParams();
  const location = useLocation();
  const { isCmsAvailable } = useIsCmsAvailable();
  const { hasObservability } = useHasObservability();

  const isExperimentalFeatures = coreFeatures.has('datasets');
  const showPlayground = isCmsAvailable && isExperimentalFeatures;
  const showObservability = hasObservability && isExperimentalFeatures;

  const { data: agent } = useAgent(agentId!);

  const defaultProvider = cleanProviderId(agent?.provider ?? '');
  const defaultModel = agent?.modelId ?? '';

  const activeTab: AgentPageTab | 'none' = location.pathname.includes('/threads')
    ? 'chat'
    : location.pathname.includes('/editor')
      ? 'versions'
      : location.pathname.includes('/evaluate')
        ? 'evaluate'
        : location.pathname.includes('/traces')
          ? 'traces'
          : 'none';

  const content = (
    <KeyboardScope>
      <AgentShortcuts agentId={agentId!} />
      <OverviewPanelShortcuts />
      <AgentDetailHeaderActions agentId={agentId!} />
      <RouteSidePanel owner="agent-detail">
        <ActivatedSkillsProvider key={agentId}>
          <AgentOverviewPanel agentId={agentId!} />
        </ActivatedSkillsProvider>
      </RouteSidePanel>
      <MainContentLayout>
        <AgentPageTabs
          agentId={agentId!}
          activeTab={activeTab}
          showPlayground={showPlayground}
          showObservability={showObservability}
          rightSlot={
            activeTab === 'chat' ? (
              <ThreadTracesToggle />
            ) : activeTab === 'evaluate' ? (
              <AgentTopBarRunOptions requestContextSchema={agent?.requestContextSchema} />
            ) : undefined
          }
        />
        {children}
      </MainContentLayout>
    </KeyboardScope>
  );

  return (
    <TracingSettingsProvider entityId={agentId!} entityType="agent">
      <SchemaRequestContextProvider>
        <PlaygroundModelProvider
          key={`${agentId}:${defaultProvider}/${defaultModel}`}
          defaultProvider={defaultProvider}
          defaultModel={defaultModel}
        >
          <GenerationProvider>
            <ReviewQueueProvider>{content}</ReviewQueueProvider>
          </GenerationProvider>
        </PlaygroundModelProvider>
      </SchemaRequestContextProvider>
    </TracingSettingsProvider>
  );
};
