import { coreFeatures } from '@mastra/core/features';
import { MainContentLayout, AgentPageTabs, useIsCmsAvailable } from '@mastra/playground-ui';
import type { AgentPageTab } from '@mastra/playground-ui';
import { useParams, useLocation } from 'react-router';

import { AgentHeader } from './agent-header';

export const AgentLayout = ({ children }: { children: React.ReactNode }) => {
  const { agentId } = useParams();
  const location = useLocation();
  const { isCmsAvailable } = useIsCmsAvailable();

  const isExperimentalFeatures = coreFeatures.has('datasets');
  const showPlayground = isCmsAvailable && isExperimentalFeatures;

  const activeTab: AgentPageTab = location.pathname.includes('/playground')
    ? 'playground'
    : location.pathname.includes('/traces')
      ? 'traces'
      : 'chat';

  return (
    <MainContentLayout className="grid-rows-[auto_auto_1fr]">
      <AgentHeader agentId={agentId!} />
      <AgentPageTabs agentId={agentId!} activeTab={activeTab} showPlayground={showPlayground} />
      {children}
    </MainContentLayout>
  );
};
