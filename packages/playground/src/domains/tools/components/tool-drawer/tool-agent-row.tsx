import { Badge } from '@mastra/playground-ui/components/Badge';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import type { ToolAgent } from '../../hooks/use-tool-agents';

export interface ToolAgentRowProps {
  agent: ToolAgent;
  /** The agent the drawer was opened from: marked Current instead of linked. */
  isCurrent: boolean;
}

/** One agent in "Used by": the whole row links to the agent, except the current one, which is marked instead. */
export function ToolAgentRow({ agent, isCurrent }: ToolAgentRowProps) {
  const { Link, paths } = useLinkComponent();

  const name = (
    <DataList.NameCell>
      <span className="flex min-w-0 items-center gap-2">
        <Icon size="sm" className="shrink-0 text-muted-foreground">
          <AgentIcon />
        </Icon>
        {agent.name}
      </span>
    </DataList.NameCell>
  );

  if (isCurrent) {
    return (
      <DataList.RowStatic>
        {name}
        <DataList.Cell>
          <Badge variant="neutral" emphasis="subtle">
            Current
          </Badge>
        </DataList.Cell>
      </DataList.RowStatic>
    );
  }

  return (
    <DataList.RowLink to={paths.agentLink(agent.id)} LinkComponent={Link}>
      {name}
      {/* A plain span: an empty DataList cell would show its "—" placeholder. */}
      <span />
    </DataList.RowLink>
  );
}
