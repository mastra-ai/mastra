import { Button } from '@mastra/playground-ui/components/Button';
import { ArrowLeftIcon } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router';
import { useBuilderAgentAccess, useBuilderAgentFeatures } from '@/domains/agent-builder';
import { AgentBuilderStarter } from '@/domains/agent-builder/components/agent-starter/agent-builder-starter';
import { useAgentBuilderAllowedModels } from '@/domains/agent-builder/hooks/use-agent-builder-allowed-models';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useStoredSkills } from '@/domains/agents/hooks/use-stored-skills';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

const AGENT_BUILDER_AGENTS_ROUTE = '/agent-builder/agents';

export default function AgentBuilderCreate() {
  const { canWrite } = useBuilderAgentAccess();
  const navigate = useNavigate();
  // Warm the ['tools'], ['agents', requestContext], ['workflows', requestContext], and
  // ['stored-skills'] tanstack-query caches while the user types their prompt, so the
  // edit page can dispatch the initial message with a tools- and skills-aware schema on
  // its very first render instead of waiting for the queries to resolve.
  const features = useBuilderAgentFeatures();
  useTools({ enabled: canWrite && features.tools });
  useAgents({ enabled: canWrite && features.agents });
  useWorkflows({ enabled: canWrite && features.workflows });
  useStoredSkills({ enabled: canWrite && features.skills });
  // Prefetch and seed the ['builder-available-models'] cache (return value
  // ignored) so the starter/model picker render instantly instead of waiting on
  // the cold gateway-backed request when this page or the edit page mounts.
  useAgentBuilderAllowedModels({ enabled: canWrite });

  if (!canWrite) return <Navigate to={AGENT_BUILDER_AGENTS_ROUTE} replace />;

  return (
    <>
      <div className="absolute top-3 left-3 z-10 md:top-6 md:left-6">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() =>
            navigate(AGENT_BUILDER_AGENTS_ROUTE, {
              viewTransition: true,
            })
          }
          className="rounded-full"
          tooltip="Agents list"
          data-testid="agent-builder-back-to-list"
        >
          <ArrowLeftIcon />
        </Button>
      </div>

      <AgentBuilderStarter />
    </>
  );
}
