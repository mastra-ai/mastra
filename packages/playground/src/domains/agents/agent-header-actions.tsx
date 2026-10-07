import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { HeaderCreateAction } from '@/components/ui/header-create-action';
import { useCanCreateAgent } from '@/domains/agent-builder/hooks/use-can-create-agent';

export function AgentHeaderCreateAction() {
  const { canCreateAgent } = useCanCreateAgent();
  const { paths } = useLinkComponent();
  const createPath = paths.agentCreateLink();
  if (!canCreateAgent || !createPath) return null;
  return (
    <HeaderCreateAction href={createPath} tooltip="Create an agent">
      New agent
    </HeaderCreateAction>
  );
}
