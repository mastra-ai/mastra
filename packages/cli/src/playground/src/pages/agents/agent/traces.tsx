import { AgentTraces } from '@mastra/playground-ui';
import { useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { AgentInformation } from '@/domains/agents/agent-information';
import { useAgent } from '@/hooks/use-agents';

function AgentTracesPage() {
  const { agentId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);

  if (isAgentLoading) {
    return (
      <main className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
        <div className="p-4">
          <Skeleton className="h-[600px]" />
        </div>
        <div className="flex flex-col">
          <AgentInformation agentId={agentId!} />
        </div>
      </main>
    );
  }

  return <AgentTraces agentName={agent?.name!} baseUrl="" sidebarChild={<AgentInformation agentId={agentId!} />} />;
}

export default AgentTracesPage;
