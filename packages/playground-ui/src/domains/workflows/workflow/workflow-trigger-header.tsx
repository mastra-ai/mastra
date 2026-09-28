import type { GetWorkflowResponse } from '@mastra/client-js';
import { Badge } from '@/ds/components/Badge';
import { CopyButton } from '@/ds/components/CopyButton';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';

export function InitialWorkflowHeader({ workflow, workflowId }: { workflow: GetWorkflowResponse; workflowId: string }) {
  const stepsCount = Object.keys(workflow.steps ?? {}).length;

  return (
    <div className="flex w-full items-center gap-2 px-5">
      <Icon className="shrink-0 text-muted-foreground">
        <WorkflowIcon />
      </Icon>
      <Txt as="span" variant="subheading" tone="ink" className="truncate">
        {workflow.name ?? workflowId}
      </Txt>
      <CopyButton content={workflow.name ?? workflowId} variant="ghost" className="shrink-0" />
      <Badge className="ml-auto shrink-0">
        {stepsCount} step{stepsCount === 1 ? '' : 's'}
      </Badge>
    </div>
  );
}
