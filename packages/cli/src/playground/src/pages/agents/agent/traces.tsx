import { TracesView, TracesViewSkeleton } from '@mastra/playground-ui';
import { useParams } from 'react-router';

import { useAgent } from '@/hooks/use-agents';

function AgentTracesPage() {
  const { agentId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);

  if (isAgentLoading) {
    return <TracesViewSkeleton />;
  }

  return <TracesView componentType="agent" componentName={agent?.name || ''} className="h-[calc(100vh-40px)]" />;
}

export default AgentTracesPage;
