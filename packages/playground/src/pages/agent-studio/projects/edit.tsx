import { Navigate, useParams } from 'react-router';

/**
 * Project edit currently delegates to the stored-agent edit surface — a project
 * is a supervisor stored agent, so all fields are edited in the same form.
 */
export function AgentStudioProjectEdit() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return <Navigate to="/agent-studio/projects" replace />;
  return <Navigate to={`/cms/agents/${projectId}/edit`} replace />;
}

export default AgentStudioProjectEdit;
