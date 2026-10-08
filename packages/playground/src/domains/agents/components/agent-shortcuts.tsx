import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useNavigate } from 'react-router';

/** Shadows global navigation with agent-scoped targets while the route is mounted. */
export function AgentShortcuts({ agentId }: { agentId: string }) {
  const navigate = useNavigate();
  useKeydown({ 'g$+t': () => navigate(`/agents/${agentId}/traces`) });
  return null;
}
