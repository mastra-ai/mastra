import { AgentEvals } from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { useEvalsByAgentId } from '@/domains/evals/hooks/use-evals-by-agent-id';
import { MainContent } from '@mastra/playground-ui';

function AgentEvalsPage() {
  const { agentId } = useParams();
  const { data: liveEvals, isLoading: isLiveLoading, refetch: refetchLiveEvals } = useEvalsByAgentId(agentId!, 'live');
  const { data: ciEvals, isLoading: isCiLoading, refetch: refetchCiEvals } = useEvalsByAgentId(agentId!, 'ci');

  if (isLiveLoading || isCiLoading) return null; // resolves too fast locally

  return (
    <MainContent width="full" className="items-normal content-normal col-span-full">
      <AgentEvals
        liveEvals={liveEvals?.evals ?? []}
        ciEvals={ciEvals?.evals ?? []}
        onRefetchLiveEvals={refetchLiveEvals}
        onRefetchCiEvals={refetchCiEvals}
      />
    </MainContent>
  );
}

export default AgentEvalsPage;
