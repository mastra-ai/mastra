import { AgentEvals } from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { useEvalsByAgentId } from '@/domains/evals/hooks/use-evals-by-agent-id';
import { AgentTraces, MainContent, MainHeader, MainLayout } from '@mastra/playground-ui';
import { AgentHeader } from '@/domains/agents/agent-header';

function AgentEvalsPage() {
  const { agentId } = useParams();
  const { data: liveEvals, isLoading: isLiveLoading, refetch: refetchLiveEvals } = useEvalsByAgentId(agentId!, 'live');
  const { data: ciEvals, isLoading: isCiLoading, refetch: refetchCiEvals } = useEvalsByAgentId(agentId!, 'ci');

  if (isLiveLoading || isCiLoading) return null; // resolves too fast locally

  return (
    <MainLayout>
      <MainHeader width="full" className="sticky top-0 bg-surface1 z-[100]">
        <AgentHeader agentId={agentId!} />
      </MainHeader>
      <MainContent width="full">
        <AgentEvals
          liveEvals={liveEvals?.evals ?? []}
          ciEvals={ciEvals?.evals ?? []}
          onRefetchLiveEvals={refetchLiveEvals}
          onRefetchCiEvals={refetchCiEvals}
        />
      </MainContent>
    </MainLayout>
  );
}

export default AgentEvalsPage;
