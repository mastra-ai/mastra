import { useParams } from 'react-router';

import { AgentEvals } from '@/domains/agents/agent-evals';

function AgentEvalsPage() {
  const { agentId } = useParams();

  return (
    <main className="flex-1">
      <AgentEvals agentId={agentId!} />
    </main>
  );
}

export default AgentEvalsPage;
