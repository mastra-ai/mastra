import { AgentEvals } from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { useEvalsByAgentId } from '@/domains/evals/hooks/use-evals-by-agent-id';
import { useNewUI } from '@/hooks/use-new-ui';

function AgentEvalsPage() {
  const { agentId } = useParams();
  const { data: liveEvals, isLoading: isLiveLoading, refetch: refetchLiveEvals } = useEvalsByAgentId(agentId!, 'live');
  const { data: ciEvals, isLoading: isCiLoading, refetch: refetchCiEvals } = useEvalsByAgentId(agentId!, 'ci');
  const newUIEnabled = useNewUI();

  if (isLiveLoading || isCiLoading) return null; // resolves too fast locally

  return newUIEnabled ? (
    <AgentEvals
      liveEvals={liveEvals?.evals ?? []}
      ciEvals={ciEvals?.evals ?? []}
      onRefetchLiveEvals={refetchLiveEvals}
      onRefetchCiEvals={refetchCiEvals}
    />
  ) : (
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
