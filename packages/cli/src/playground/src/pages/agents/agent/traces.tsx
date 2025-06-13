import { AgentTraces, MainContent, MainHeader, MainLayout } from '@mastra/playground-ui';
import { useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { useAgent } from '@/hooks/use-agents';
import { useTraces } from '@/domains/traces/hooks/use-traces';
import { AgentHeader } from '@/domains/agents/agent-header';

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
    <MainLayout>
      <MainHeader width="full" className="sticky top-0 bg-surface1 z-[100]">
        <AgentHeader agentId={agentId!} />
      </MainHeader>
      <MainContent width="full" className="items-normal content-normal">
        <AgentTraces traces={traces || []} error={error} />
      </MainContent>
    </MainLayout>
  );
}

export default AgentTracesPage;
