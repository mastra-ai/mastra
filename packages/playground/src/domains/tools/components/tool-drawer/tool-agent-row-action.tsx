import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import type { ToolAgent } from '../../hooks/use-tool-agents';

export interface ToolAgentRowActionProps {
  agent: ToolAgent;
  isCurrent: boolean;
}

/** "Current" for the agent the drawer was opened from, a link to the agent otherwise. */
export function ToolAgentRowAction({ agent, isCurrent }: ToolAgentRowActionProps) {
  const { Link } = useLinkComponent();

  if (isCurrent) {
    return (
      <Badge variant="neutral" emphasis="subtle">
        Current
      </Badge>
    );
  }

  return (
    // Pull the ghost button's own padding out so its text lines up with the types above.
    <Button
      variant="ghost"
      size="sm"
      className="-mr-3"
      render={<Link href={`/agents/${encodeURIComponent(agent.id)}`} />}
    >
      Open
    </Button>
  );
}
