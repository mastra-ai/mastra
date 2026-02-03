import { useParams } from 'react-router';

import { AgentHeader } from './agent-header';
import { MainContentLayout } from '@mastra/playground-ui';

export const AgentLayout = ({ children }: { children: React.ReactNode }) => {
  const { agentId, threadId } = useParams();

  return (
    <MainContentLayout>
      <AgentHeader agentId={agentId!} threadId={threadId} />

      {children}
    </MainContentLayout>
  );
};
