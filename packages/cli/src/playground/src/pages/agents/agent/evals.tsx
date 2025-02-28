import { AgentEvals } from '@mastra/playground-ui';
import { useParams } from 'react-router';

function AgentEvalsPage() {
  const { agentId } = useParams();

  return (
    <main className="min-h-0">
      <AgentEvals agentId={agentId!} baseUrl="" />
    </main>
  );
}

export default AgentEvalsPage;
