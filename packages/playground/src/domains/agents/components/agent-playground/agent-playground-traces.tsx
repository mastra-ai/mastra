import { AgentTracesPanel } from '../agent-traces-panel';

interface AgentPlaygroundTracesProps {
  agentId: string;
}

export function AgentPlaygroundTraces({ agentId }: AgentPlaygroundTracesProps) {
  return (
    <div className="flex flex-col h-full">
      <AgentTracesPanel agentId={agentId} />
    </div>
  );
}
