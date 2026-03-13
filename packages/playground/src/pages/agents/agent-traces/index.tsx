import { AgentTracesPanel } from '@mastra/playground-ui';
import { useParams } from 'react-router';

function AgentTraces() {
  const { agentId } = useParams();

  return <AgentTracesPanel agentId={agentId!} />;
}

export default AgentTraces;
