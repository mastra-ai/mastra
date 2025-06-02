import { AgentEvals } from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { useEvalsByAgentId } from '../../../domains/evals/hooks/use-evals-by-agent-id';

function AgentEvalsPage() {
  const { agentId } = useParams();

  const {
    evals: liveEvals,
    isLoading: isLiveLoading,
    refetchEvals: refetchLiveEvals,
  } = useEvalsByAgentId(agentId!, 'live');
  const { evals: ciEvals, isLoading: isCiLoading, refetchEvals: refetchCiEvals } = useEvalsByAgentId(agentId!, 'ci');

  if (isLiveLoading || isCiLoading) return null; // resolves too fast locally

  return (
    <main className="h-full overflow-hidden">
      <AgentEvals
        liveEvals={liveEvals}
        ciEvals={ciEvals}
        onRefetchLiveEvals={refetchLiveEvals}
        onRefetchCiEvals={refetchCiEvals}
      />
    </main>
  );
}

export default AgentEvalsPage;
