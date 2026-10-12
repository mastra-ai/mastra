import { useParams } from 'react-router';
import ExperimentsPage from '@/pages/experiments';

function AgentEvals() {
  const { agentId } = useParams();
  if (!agentId) return null;
  return <ExperimentsPage key={agentId} scopedTarget={{ targetType: 'agent', targetId: agentId }} />;
}

export default AgentEvals;
