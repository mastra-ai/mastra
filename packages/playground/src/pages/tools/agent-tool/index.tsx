import { useParams } from 'react-router';
import { AgentToolPanel } from '@/domains/agents/components/AgentToolPanel';

const AgentTool = () => {
  const { toolId, agentId } = useParams();

  return (
    <div className="h-full w-full overflow-y-auto">
      <AgentToolPanel toolId={toolId!} agentId={agentId!} />
    </div>
  );
};

export default AgentTool;
