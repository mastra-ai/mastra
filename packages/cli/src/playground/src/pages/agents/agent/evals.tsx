import { useParams } from 'react-router';

import { AgentEvals } from '@/domains/agents/agent-evals';

function AgentEvalsPage() {
  const { agentId } = useParams();

  return (
    <main className="flex-1 min-h-0">
      <AgentEvals agentId={agentId!} />
    </main>
  );
}

export default AgentEvalsPage;
