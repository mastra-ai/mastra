import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import type { ToolAgent } from '../../hooks/use-tool-agents';

export interface ToolAgentRowProps {
  agent: ToolAgent;
  /** The agent the drawer was opened from: marked Current instead of linked. */
  isCurrent: boolean;
}

export function ToolAgentRow({ agent, isCurrent }: ToolAgentRowProps) {
  const { Link } = useLinkComponent();

  return (
    <SettingsRow
      label={
        <span className="flex min-w-0 items-center gap-2">
          <Icon size="sm" className="shrink-0 text-muted-foreground">
            <AgentIcon />
          </Icon>
          <span className="truncate">{agent.name}</span>
        </span>
      }
    >
      {isCurrent ? (
        <Badge variant="neutral" emphasis="subtle">
          Current
        </Badge>
      ) : (
        // Pull the ghost button's own padding out so its text lines up with the types above.
        <Button
          variant="ghost"
          size="sm"
          className="-mr-3"
          render={<Link href={`/agents/${encodeURIComponent(agent.id)}`} />}
        >
          Open
        </Button>
      )}
    </SettingsRow>
  );
}
