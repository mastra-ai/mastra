import { coreFeatures } from '@mastra/core/features';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { TracingSettingsProvider } from '@mastra/playground-ui/domains/observability/context/tracing-settings-context';
import { KeyboardScope } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useParams, useLocation, useNavigate } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { AgentDetailHeaderActions } from '@/domains/agents/components/agent-detail-header-actions';
import { AgentOverviewPanel } from '@/domains/agents/components/agent-overview-panel/agent-overview-panel';
import { AgentPageTabs } from '@/domains/agents/components/agent-page-tabs';
import type { AgentPageTab } from '@/domains/agents/components/agent-page-tabs';
import { OverviewPanelShortcuts } from '@/domains/agents/components/overview-panel-shortcuts';
import { ActivatedSkillsProvider } from '@/domains/agents/context/activated-skills-context';
import { PlaygroundModelProvider } from '@/domains/agents/context/playground-model-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useHasObservability } from '@/domains/configuration/hooks/use-has-observability';
import { cleanProviderId } from '@/domains/llm/utils';
import { agentCrumb, navCrumb } from '@/domains/navigation/crumbs';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
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

  const { data: agent } = useAgent(agentId!);

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
    <TracingSettingsProvider entityId={agentId!} entityType="agent">
      <SchemaRequestContextProvider>
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
              <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
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
      </SchemaRequestContextProvider>
    </TracingSettingsProvider>
  );
};
