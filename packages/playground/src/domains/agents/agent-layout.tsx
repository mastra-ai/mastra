import { coreFeatures } from '@mastra/core/features';
import {
  MainContentLayout,
  AgentPageTabs,
  AgentTopBarControls,
  useIsCmsAvailable,
  useHasObservability,
  useAgent,
  cleanProviderId,
  SchemaRequestContextProvider,
  PlaygroundModelProvider,
  ReviewQueueProvider,
  GenerationProvider,
} from '@mastra/playground-ui';
import type { AgentPageTab } from '@mastra/playground-ui';
import { useParams, useLocation } from 'react-router';

import { AgentHeader } from './agent-header';

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

  const content = (
    <MainContentLayout className="grid-rows-[auto_auto_1fr]">
      <AgentHeader agentId={agentId!} />
      <AgentPageTabs
        agentId={agentId!}
        activeTab={activeTab}
        showPlayground={showPlayground}
        showObservability={showObservability}
        rightSlot={showTopBarControls ? <AgentTopBarControls requestContextSchema={requestContextSchema} /> : undefined}
      />
      {children}
    </MainContentLayout>
  );

  return (
    <SchemaRequestContextProvider>
      <PlaygroundModelProvider defaultProvider={defaultProvider} defaultModel={defaultModel}>
        <GenerationProvider>
          <ReviewQueueProvider>{content}</ReviewQueueProvider>
        </GenerationProvider>
      </PlaygroundModelProvider>
    </SchemaRequestContextProvider>
  );
};
