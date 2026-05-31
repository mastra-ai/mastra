import { Button } from '@mastra/playground-ui';
import { Plus } from 'lucide-react';
import { useCanCreateAgent } from '@/domains/agent-builder/hooks/use-can-create-agent';
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
    <RouteHeaderActions owner="agent-list">
      <Button as={Link} to={createPath} tooltip="Create an agent" size="icon-sm">
        <Plus />
      </Button>
    </RouteHeaderActions>
  );
}
