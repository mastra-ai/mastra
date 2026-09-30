import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';

export interface ToolCurrentAgentProps {
  name: string;
}

/** Same row as `ToolAgentLink`, disabled: you're already on this agent. */
export function ToolCurrentAgent({ name }: ToolCurrentAgentProps) {
  return (
    <Button variant="ghost" size="sm" icon={<AgentIcon />} className="w-full justify-start" disabled>
      <span className="truncate">{name}</span>
      <Badge variant="neutral" emphasis="subtle" size="xs">
        Current
      </Badge>
    </Button>
  );
}
