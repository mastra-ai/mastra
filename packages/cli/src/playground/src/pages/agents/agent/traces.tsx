import { AgentTraces, MainContent } from '@mastra/playground-ui';
import { useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { useAgent } from '@/hooks/use-agents';
import { useTraces } from '@/domains/traces/hooks/use-traces';

function AgentTracesPage() {
  const { agentId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const { traces, firstCallLoading, error } = useTraces(agent?.name || '');

  if (isAgentLoading || firstCallLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-10" />
      </div>
    );
  }

  return (
    <MainContent width="full" className="items-normal content-normal col-span-full">
      <AgentTraces traces={traces || []} error={error} />
    </MainContent>
  );
}

export default AgentTracesPage;
