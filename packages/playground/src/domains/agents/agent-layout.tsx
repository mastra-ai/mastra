import { MainContentLayout } from '@mastra/playground-ui';
import { useParams } from 'react-router';

import { AgentHeader } from './agent-header';

export const AgentLayout = ({ children }: { children: React.ReactNode }) => {
  const { agentId } = useParams();

  return (
    <MainContentLayout>
      <AgentHeader agentId={agentId!} />

      {children}
    </MainContentLayout>
  );
};
