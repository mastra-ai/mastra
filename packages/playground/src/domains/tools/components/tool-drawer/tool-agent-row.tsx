import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import type { ToolAgent } from '../../hooks/use-tool-agents';
import { ToolAgentRowAction } from './tool-agent-row-action';

export interface ToolAgentRowProps {
  agent: ToolAgent;
  /** The agent the drawer was opened from: marked Current instead of linked. */
  isCurrent: boolean;
}

export function ToolAgentRow({ agent, isCurrent }: ToolAgentRowProps) {
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
      <ToolAgentRowAction agent={agent} isCurrent={isCurrent} />
    </SettingsRow>
  );
}
