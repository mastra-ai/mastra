import { coreFeatures } from '@mastra/core/features';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { ActivatedSkillsProvider } from '@mastra/playground-ui/domains/agents/context/activated-skills-context';
import { cleanProviderId } from '@mastra/playground-ui/domains/llm';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { KeyboardScope } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useAgent } from '@mastra/react/hooks';
import { useParams, useLocation, useNavigate } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { AgentDetailHeaderActions } from '@/domains/agents/components/agent-detail-header-actions';
import { AgentOverviewPanel } from '@/domains/agents/components/agent-overview-panel/agent-overview-panel';
import { AgentPageTabs } from '@/domains/agents/components/agent-page-tabs';
import type { AgentPageTab } from '@/domains/agents/components/agent-page-tabs';
import { OverviewPanelShortcuts } from '@/domains/agents/components/overview-panel-shortcuts';
import { PlaygroundModelProvider } from '@/domains/agents/context/playground-model-context';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useHasObservability } from '@/domains/configuration/hooks/use-has-observability';
import { agentCrumb, navCrumb } from '@/domains/navigation/crumbs';
import { RouteSidePanel } from '@/lib/route-side-panel';

const crumbs = [navCrumb('/agents'), agentCrumb];

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

  const { data: agent } = useAgent(agentId!, useEntityRequestContext('agent', agentId!)[0]);

  const defaultProvider = cleanProviderId(agent?.provider ?? '');
  const defaultModel = agent?.modelId ?? '';

  const activeTab: AgentPageTab | 'none' = location.pathname.includes('/threads')
    ? 'chat'
    : location.pathname.includes('/editor')
      ? 'versions'
      : location.pathname.includes('/traces')
        ? 'traces'
        : 'none';

  return (
    <PlaygroundModelProvider
      key={`${agentId}:${defaultProvider}/${defaultModel}`}
      defaultProvider={defaultProvider}
      defaultModel={defaultModel}
    >
      <KeyboardScope>
        <AgentShortcuts agentId={agentId!} />
        <OverviewPanelShortcuts />

        <PageLayout
          variant="fit"
          breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
          headerActions={<AgentDetailHeaderActions agentId={agentId!} />}
        >
          <h1 className="sr-only">{agentId}</h1>
          <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)]">
            <AgentPageTabs
              agentId={agentId!}
              activeTab={activeTab}
              showPlayground={showPlayground}
              showObservability={showObservability}
            />
            {children}
          </div>
        </PageLayout>

        <RouteSidePanel owner="agent-detail">
          <ActivatedSkillsProvider key={agentId}>
            <AgentOverviewPanel agentId={agentId!} />
          </ActivatedSkillsProvider>
        </RouteSidePanel>
      </KeyboardScope>
    </PlaygroundModelProvider>
  );
};
