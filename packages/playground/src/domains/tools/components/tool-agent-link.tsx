import { Button } from '@mastra/playground-ui/components/Button';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';

export interface ToolAgentLinkProps {
  agentId: string;
  name: string;
}

export function ToolAgentLink({ agentId, name }: ToolAgentLinkProps) {
  const { Link } = useLinkComponent();
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={<AgentIcon />}
      className="w-full justify-start"
      render={<Link href={`/agents/${encodeURIComponent(agentId)}`} />}
    >
      <span className="truncate">{name}</span>
    </Button>
  );
}
