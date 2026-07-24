import type { GetAgentResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { CardTitle } from '@mastra/playground-ui/components/Card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { useId } from 'react';

export interface AgentSubagentDetailsProps {
  agentName: string;
  agents?: GetAgentResponse['agents'];
}

function formatAgentCount(count: number) {
  return `${count} agent${count === 1 ? '' : 's'}`;
}

export function AgentSubagentDetails({ agentName, agents }: AgentSubagentDetailsProps) {
  const titleId = useId();
  const agentEntries = Object.entries(agents ?? {});

  if (agentEntries.length === 0) return null;

  const agentCount = formatAgentCount(agentEntries.length);

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={0}
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="pointer-events-auto"
            aria-label={`Show ${agentCount} for ${agentName}`}
          >
            <AgentIcon aria-hidden="true" />
            <span>{agentEntries.length}</span>
          </Button>
        }
      />
      <HoverCardContent
        role="dialog"
        aria-labelledby={titleId}
        side="top"
        align="center"
        className="w-80 max-w-[calc(100vw-2rem)]"
      >
        <div className="grid gap-3">
          <CardTitle id={titleId}>Agents</CardTitle>
          <ul
            aria-label={`Configured agents for ${agentName}`}
            className="grid max-h-64 gap-2 overflow-y-auto"
            tabIndex={0}
          >
            {agentEntries.map(([agentKey, agent]) => (
              <li key={agentKey} className="overflow-wrap-anywhere text-ui-sm text-neutral5 font-medium">
                {agent.name || agent.id || agentKey}
              </li>
            ))}
          </ul>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
