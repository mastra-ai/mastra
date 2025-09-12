import { useAgent } from '@/hooks/use-agents';
import { AgentNetwork } from '@mastra/playground-ui';

import { useParams } from 'react-router';

export default function Network() {
  const { agentId } = useParams();
  const { data: agent, isLoading } = useAgent(agentId!);

  if (isLoading) return <div>Loading...</div>;
  if (!agent) return <div>Agent not found</div>;

  return <AgentNetwork agent={agent} />;
}
