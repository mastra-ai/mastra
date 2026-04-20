import { coreFeatures } from '@mastra/core/features';
import { MainContentLayout } from '@mastra/playground-ui';
import { useParams, useLocation } from 'react-router';
import { AgentHeader } from './agent-header';
import { AgentPageTabs } from '@/domains/agents/components/agent-page-tabs';
import type { AgentPageTab } from '@/domains/agents/components/agent-page-tabs';
import { AgentTopBarControls } from '@/domains/agents/components/agent-top-bar-controls';
import { PanelSizingProvider } from '@/domains/agents/context/panel-sizing-context';
import { PanelVisibilityProvider } from '@/domains/agents/context/panel-visibility-context';
import { PlaygroundModelProvider } from '@/domains/agents/context/playground-model-context';
import { ReviewQueueProvider } from '@/domains/agents/context/review-queue-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useHasObservability } from '@/domains/configuration/hooks/use-has-observability';
import { GenerationProvider } from '@/domains/datasets/context/generation-context';
import { cleanProviderId } from '@/domains/llm/utils';
import { useMemory } from '@/domains/memory/hooks';
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
  const { data: memory } = useMemory(agentId!);
  const hasMemory = Boolean(memory?.result);

  const defaultProvider = cleanProviderId(agent?.provider ?? '');
  const defaultModel = agent?.modelId ?? '';
  const requestContextSchema = agent?.requestContextSchema;

  const activeTab: AgentPageTab = location.pathname.includes('/editor')
    ? 'versions'
    : location.pathname.includes('/evaluate')
      ? 'evaluate'
      : location.pathname.includes('/review')
        ? 'review'
        : location.pathname.includes('/traces')
          ? 'traces'
          : 'chat';

  const showTopBarControls =
    (activeTab === 'versions' || activeTab === 'evaluate' || activeTab === 'review') &&
    (showPlayground || showObservability);

  return (
    <PanelVisibilityProvider>
      <PanelSizingProvider>
        <SchemaRequestContextProvider>
          <PlaygroundModelProvider defaultProvider={defaultProvider} defaultModel={defaultModel}>
            <GenerationProvider>
              <ReviewQueueProvider>
                <MainContentLayout className="grid-rows-[auto_1fr]">
                  <AgentHeader agentId={agentId!}>
                    <AgentPageTabs
                      agentId={agentId!}
                      activeTab={activeTab}
                      hasMemory={hasMemory}
                      showPlayground={showPlayground}
                      showObservability={showObservability}
                      rightSlot={
                        showTopBarControls ? (
                          <AgentTopBarControls requestContextSchema={requestContextSchema} />
                        ) : undefined
                      }
                    />
                  </AgentHeader>
                  {children}
                </MainContentLayout>
              </ReviewQueueProvider>
            </GenerationProvider>
          </PlaygroundModelProvider>
        </SchemaRequestContextProvider>
      </PanelSizingProvider>
    </PanelVisibilityProvider>
  );
};
