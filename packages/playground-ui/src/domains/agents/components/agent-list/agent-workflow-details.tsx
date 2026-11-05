import type { GetAgentResponse } from '@mastra/client-js';
import { useId } from 'react';
import { Button } from '@/ds/components/Button';
import { CardDescription, CardTitle } from '@/ds/components/Card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/ds/components/HoverCard';
import { Txt } from '@/ds/components/Txt';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';

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
            icon={<WorkflowIcon aria-hidden="true" />}
          >
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
                <Txt as="span" variant="column" tone="ink" className="overflow-wrap-anywhere">
                  {workflow.name || workflowKey}
                </Txt>
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
