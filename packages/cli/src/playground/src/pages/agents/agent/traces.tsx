import { AgentTraces, useTraces } from '@mastra/playground-ui';
import { useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { useAgent } from '@/hooks/use-agents';

function AgentTracesContent() {
  const { agentId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const { traces, firstCallLoading, error } = useTraces(agent?.name || '', '');

  if (isAgentLoading || firstCallLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-10" />
      </div>
    );
  }

  return <AgentTraces traces={traces || []} error={error} className="h-[calc(100vh-40px)]" />;
}

function AgentTracesPage() {
  return <AgentTracesContent />;
}

export default AgentTracesPage;
