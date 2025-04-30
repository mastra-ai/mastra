import { AgentTraces, TraceProvider, useTraces } from '@mastra/playground-ui';
import { useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { useAgent } from '@/hooks/use-agents';

function AgentTracesInner() {
  const { agentId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);

  const { traces, firstCallLoading, error } = useTraces(agent?.name || '', '');

  if (isAgentLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-10" />
      </div>
    );
  }

  return (
    <AgentTraces traces={traces || []} isLoading={firstCallLoading} error={error} className="h-[calc(100vh-40px)]" />
  );
}

function AgentTracesPage() {
  // Wrap the inner component with TraceProvider to provide context for useTraces
  return (
    <TraceProvider>
      <AgentTracesInner />
    </TraceProvider>
  );
}

export default AgentTracesPage;
