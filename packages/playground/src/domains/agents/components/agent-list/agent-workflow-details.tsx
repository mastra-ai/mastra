import type { GetAgentResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { CardDescription, CardTitle } from '@mastra/playground-ui/components/Card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { useId } from 'react';

export interface AgentWorkflowDetailsProps {
  agentName: string;
  workflows?: GetAgentResponse['workflows'];
}

function formatWorkflowCount(count: number) {
  return `${count} workflow${count === 1 ? '' : 's'}`;
}

export function AgentWorkflowDetails({ agentName, workflows }: AgentWorkflowDetailsProps) {
  const titleId = useId();
  const workflowEntries = Object.entries(workflows ?? {});

  if (workflowEntries.length === 0) return null;

  const workflowCount = formatWorkflowCount(workflowEntries.length);

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
            aria-label={`Show ${workflowCount} for ${agentName}`}
          >
            <WorkflowIcon aria-hidden="true" />
            <span>{workflowEntries.length}</span>
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
          <CardTitle id={titleId}>Workflows</CardTitle>
          <ul
            aria-label={`Configured workflows for ${agentName}`}
            className="grid max-h-64 gap-3 overflow-y-auto"
            tabIndex={0}
          >
            {workflowEntries.map(([workflowKey, workflow]) => (
              <li key={workflowKey} className="grid gap-1">
                <span className="overflow-wrap-anywhere text-ui-sm font-medium text-neutral5">
                  {workflow.name || workflowKey}
                </span>
                {workflow.description ? (
                  <CardDescription className="overflow-wrap-anywhere">{workflow.description}</CardDescription>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
