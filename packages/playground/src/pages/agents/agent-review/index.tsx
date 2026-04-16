import {
  PermissionDenied,
  SessionExpired,
  Spinner,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { AgentPlaygroundReview } from '@/domains/agents/components/agent-playground';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useLinkComponent } from '@/lib/framework';

function AgentReview() {
  const { agentId } = useParams();
  const { navigate } = useLinkComponent();

  const { data: codeAgent, isLoading, error } = useAgent(agentId!);

  if (error && is401UnauthorizedError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <SessionExpired />
      </div>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="agents" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!codeAgent) {
    return <div className="text-center py-4">Agent not found</div>;
  }

  const handleCreateScorer = (items: Array<{ input: unknown; output: unknown }>) => {
    sessionStorage.setItem(`pending-scorer-items-${agentId}`, JSON.stringify(items));
    navigate(`/agents/${agentId}/evaluate`);
  };

  return <AgentPlaygroundReview agentId={agentId!} onCreateScorer={handleCreateScorer} />;
}

export default AgentReview;
