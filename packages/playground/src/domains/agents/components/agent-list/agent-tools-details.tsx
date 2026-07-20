import type { GetAgentResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { CardDescription, CardTitle } from '@mastra/playground-ui/components/Card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { useId } from 'react';

export interface AgentToolsDetailsProps {
  agentName: string;
  tools?: GetAgentResponse['tools'];
}

function formatToolCount(count: number) {
  return `${count} tool${count === 1 ? '' : 's'}`;
}

export function AgentToolsDetails({ agentName, tools }: AgentToolsDetailsProps) {
  const titleId = useId();
  const toolEntries = Object.entries(tools ?? {});

  if (toolEntries.length === 0) return null;

  const toolCount = formatToolCount(toolEntries.length);

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
            aria-label={`Show ${toolCount} for ${agentName}`}
          >
            <ToolsIcon aria-hidden="true" />
            <span>{toolEntries.length}</span>
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
          <CardTitle id={titleId}>Tools</CardTitle>
          <ul
            aria-label={`Configured tools for ${agentName}`}
            className="grid max-h-64 gap-3 overflow-y-auto"
            tabIndex={0}
          >
            {toolEntries.map(([toolKey, tool]) => (
              <li key={toolKey} className="grid gap-1">
                <span className="overflow-wrap-anywhere text-ui-sm font-medium text-neutral5">
                  {tool.id || toolKey}
                </span>
                {tool.description ? (
                  <CardDescription className="overflow-wrap-anywhere">{tool.description}</CardDescription>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
