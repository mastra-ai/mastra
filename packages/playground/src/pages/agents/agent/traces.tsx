import { TracesView } from '@mastra/playground-ui';
import { useParams } from 'react-router';

import { useAgent } from '@/hooks/use-agents';
import { useTraces } from '@/domains/traces/hooks/use-traces';

function AgentTracesPage() {
  const { agentId } = useParams();
  const { data: agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const { data: traces = [], isLoading: isTracesLoading, setEndOfListElement, error } = useTraces(agent?.name || '');

  return (
    <TracesView
      traces={traces}
      className="h-[calc(100vh-40px)]"
      isLoading={isAgentLoading || isTracesLoading}
      error={error}
      setEndOfListElement={setEndOfListElement}
    />
  );
}

export default AgentTracesPage;
