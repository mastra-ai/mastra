import {
  PermissionDenied,
  SessionExpired,
  Spinner,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { AgentChannels } from '@/domains/agents/components/agent-channels';
import { useAgent } from '@/domains/agents/hooks/use-agent';

function AgentChannelsPage() {
  const { agentId } = useParams();

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

  return <AgentChannels agentId={agentId!} />;
}

export default AgentChannelsPage;
