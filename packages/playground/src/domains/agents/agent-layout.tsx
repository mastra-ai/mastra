import { coreFeatures } from '@mastra/core/features';
import { MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { useParams, useLocation } from 'react-router';
import { AgentPageTabs } from '@/domains/agents/components/agent-page-tabs';
import type { AgentPageTab } from '@/domains/agents/components/agent-page-tabs';
import { AgentTopBarRunOptions } from '@/domains/agents/components/agent-top-bar-controls';
import { PlaygroundModelProvider } from '@/domains/agents/context/playground-model-context';
import { ReviewQueueProvider } from '@/domains/agents/context/review-queue-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useHasObservability } from '@/domains/configuration/hooks/use-has-observability';
import { GenerationProvider } from '@/domains/datasets/context/generation-context';
import { cleanProviderId } from '@/domains/llm/utils';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';

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
  const requestContextSchema = agent?.requestContextSchema;

  // Settings has no tab pill, so it maps to 'none' and the bar stays unhighlighted.
  const activeTab: AgentPageTab | 'none' = location.pathname.includes('/editor')
    ? 'versions'
    : location.pathname.includes('/evaluate')
      ? 'evaluate'
      : location.pathname.includes('/review')
        ? 'review'
        : location.pathname.includes('/traces')
          ? 'traces'
          : location.pathname.includes('/settings')
            ? 'none'
            : 'chat';

  const showTopBarRunOptions =
    (activeTab === 'evaluate' || activeTab === 'review') && (showPlayground || showObservability);

  const content = (
    <MainContentLayout>
      <AgentPageTabs
        agentId={agentId!}
        activeTab={activeTab}
        showPlayground={showPlayground}
        showObservability={showObservability}
        rightSlot={
          showTopBarRunOptions ? <AgentTopBarRunOptions requestContextSchema={requestContextSchema} /> : undefined
        }
      />
      {children}
    </MainContentLayout>
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
