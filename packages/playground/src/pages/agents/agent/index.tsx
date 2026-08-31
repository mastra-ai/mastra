import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useParams } from 'react-router';
import { AgentViewLoadingSkeleton } from '@/domains/agents/components/agent-loading-skeletons';
import { AgentSettingsView } from '@/domains/agents/components/agent-settings/agent-settings-view';
import { AgentViewHeader } from '@/domains/agents/components/agent-view-header';
import { ActivatedSkillsProvider } from '@/domains/agents/context/activated-skills-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';

function Agent() {
  const { agentId } = useParams();
  const { data: agent, isLoading: isAgentLoading, error } = useAgent(agentId!);

  // 401 check - session expired, needs re-authentication
  if (error && is401UnauthorizedError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <SessionExpired />
      </div>
    );
  }

  // 403 check - permission denied for agents
  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="agents" />
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
