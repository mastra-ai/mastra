import { ButtonWithTooltip } from '@mastra/playground-ui';
import { Plus } from 'lucide-react';
import { useCanCreateAgent } from '@/domains/agents/hooks/use-can-create-agent';
import { useLinkComponent } from '@/lib/framework';
import { RouteHeaderActions } from '@/lib/route-header';

/**
 * Portals the "Create agent" CTA into the route header from inside the agents
 * listing page. Kept here (not in the route handle) because it depends on a
 * hook that resolves auth/feature flags.
 */
export function AgentHeaderCreateAction() {
  const { canCreateAgent } = useCanCreateAgent();
  const { Link, paths } = useLinkComponent();
  const createPath = paths.cmsAgentCreateLink();
  if (!canCreateAgent || !createPath) return null;
  return (
    <RouteHeaderActions>
      <ButtonWithTooltip as={Link} to={createPath} tooltipContent="Create an agent" size="icon-sm">
        <Plus />
      </ButtonWithTooltip>
    </RouteHeaderActions>
  );
}
