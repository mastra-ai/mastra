import { AgentTracesPanel } from '@/domains/agents/components/agent-traces-panel';
import { useParams, useSearchParams } from 'react-router';

function AgentTraces() {
  const { agentId } = useParams();
  const [searchParams] = useSearchParams();

  return (
    <AgentTracesPanel
      agentId={agentId!}
      basePath={`/agents/${agentId!}/traces`}
      initialTraceId={searchParams.get('traceId') || undefined}
      initialSpanId={searchParams.get('spanId') || undefined}
      initialSpanTab={searchParams.get('tab') || undefined}
      initialScoreId={searchParams.get('scoreId') || undefined}
    />
  );
}

export default AgentTraces;
