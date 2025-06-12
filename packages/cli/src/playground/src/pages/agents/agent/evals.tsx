import { AgentEvals } from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { useEvalsByAgentId } from '@/domains/evals/hooks/use-evals-by-agent-id';

function AgentEvalsPage() {
  const { agentId } = useParams();
  const { data: liveEvals, isLoading: isLiveLoading, refetch: refetchLiveEvals } = useEvalsByAgentId(agentId!, 'live');
  const { data: ciEvals, isLoading: isCiLoading, refetch: refetchCiEvals } = useEvalsByAgentId(agentId!, 'ci');

  if (isLiveLoading || isCiLoading) return null; // resolves too fast locally

  return (
    <main className="h-full overflow-hidden">
      <AgentEvals
        liveEvals={liveEvals?.evals ?? []}
        ciEvals={ciEvals?.evals ?? []}
        onRefetchLiveEvals={refetchLiveEvals}
        onRefetchCiEvals={refetchCiEvals}
      />
    </main>
  );
}

export default AgentEvalsPage;
