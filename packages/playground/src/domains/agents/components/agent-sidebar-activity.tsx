import { AgentActivity } from './agent-activity';

export function AgentSidebarActivity({ agentId }: { agentId: string }) {
  return <AgentActivity agentId={agentId} variant="sidebar" />;
}
