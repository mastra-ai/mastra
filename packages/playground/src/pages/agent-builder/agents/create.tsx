import { IconButton } from '@mastra/playground-ui';
import { ArrowLeftIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useBuilderAgentFeatures } from '@/domains/agent-builder';
import { AgentBuilderStarter } from '@/domains/agent-builder/components/agent-builder-starter/agent-builder-starter';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useStoredSkills } from '@/domains/agents/hooks/use-stored-skills';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

export default function AgentBuilderCreate() {
  // Warm the ['tools'], ['agents', requestContext], ['workflows', requestContext], and
  // ['stored-skills'] tanstack-query caches while the user types their prompt, so the
  // edit page can dispatch the initial message with a tools- and skills-aware schema on
  // its very first render instead of waiting for the queries to resolve.
  const features = useBuilderAgentFeatures();
  useTools({ enabled: features.tools });
  useAgents({ enabled: features.agents });
  useWorkflows({ enabled: features.workflows });
  useStoredSkills(undefined, { enabled: features.skills });
  const navigate = useNavigate();
  return (
    <>
      <div className="absolute top-3 left-3 md:top-6 md:left-6 z-10">
        <IconButton
          variant="ghost"
          onClick={() =>
            navigate('/agent-builder/agents', {
              viewTransition: true,
            })
          }
          className="rounded-full"
          tooltip="Agents list"
        >
          <ArrowLeftIcon />
        </IconButton>
      </div>
      <AgentBuilderStarter />
    </>
  );
}
