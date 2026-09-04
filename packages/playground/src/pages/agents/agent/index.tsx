import { QueryError } from '@mastra/playground-ui/components/QueryError';
import { isAuthError } from '@mastra/playground-ui/utils/errors';
import { useParams } from 'react-router';
import { AgentViewLoadingSkeleton } from '@/domains/agents/components/agent-loading-skeletons';
import { AgentSettingsView } from '@/domains/agents/components/agent-settings/agent-settings-view';
import { AgentViewHeader } from '@/domains/agents/components/agent-view-header';
import { ActivatedSkillsProvider } from '@/domains/agents/context/activated-skills-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';

function Agent() {
  const { agentId } = useParams();
  const { data: agent, isLoading: isAgentLoading, error } = useAgent(agentId!);

  if (error && isAuthError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <QueryError error={error} resource="agents" title="Failed to load agents" />
      </div>
    );
  }

  if (isAgentLoading) {
    return <AgentViewLoadingSkeleton />;
  }

  if (!agent) {
    return <div className="py-4 text-center">Agent not found</div>;
  }

  return (
    <ActivatedSkillsProvider key={agentId}>
      <div className="grid h-full min-h-0 grid-rows-[auto_1fr]">
        <AgentViewHeader agentId={agentId!} />
        <div className="min-h-0 overflow-hidden">
          <AgentSettingsView agentId={agentId!} />
        </div>
      </div>
    </ActivatedSkillsProvider>
  );
}

export default Agent;
