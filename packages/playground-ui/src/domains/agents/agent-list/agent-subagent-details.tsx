import type { GetAgentResponse } from '@mastra/client-js';
import { useId } from 'react';
import { Button } from '@/ds/components/Button';
import { CardTitle } from '@/ds/components/Card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/ds/components/HoverCard';
import { Txt } from '@/ds/components/Txt';
import { AgentIcon } from '@/ds/icons/AgentIcon';

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
            icon={<AgentIcon aria-hidden="true" />}
          >
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
              <li key={agentKey} className="overflow-wrap-anywhere text-foreground">
                <Txt as="span" variant="column" className="block">
                  {agent.name || agent.id || agentKey}
                </Txt>
              </li>
            ))}
          </ul>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
