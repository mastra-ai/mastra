import { Spinner } from '@mastra/playground-ui/components/Spinner';

import { Navigate } from 'react-router';
import { useAgentBuilderInternalRedirect } from '@/domains/agent-builder/hooks/use-agent-builder-internal-redirect';

export const AgentBuilderRoot = () => {
  const { isLoading, hasAgents } = useAgentBuilderInternalRedirect();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (hasAgents) {
    return <Navigate to="/agent-builder/agents" />;
  }

  return <Navigate to="/agent-builder/agents/create" />;
};
