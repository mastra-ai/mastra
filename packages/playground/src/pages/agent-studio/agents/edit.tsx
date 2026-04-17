import { Navigate, useParams } from 'react-router';

export function AgentStudioAgentEdit() {
  const { agentId } = useParams<{ agentId: string }>();
  if (!agentId) return <Navigate to="/agent-studio/agents" replace />;
  return <Navigate to={`/cms/agents/${agentId}/edit`} replace />;
}

export default AgentStudioAgentEdit;
