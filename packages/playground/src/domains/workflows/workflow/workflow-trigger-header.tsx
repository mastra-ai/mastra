import type { GetWorkflowResponse } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';

export function InitialWorkflowHeader({ workflow, workflowId }: { workflow: GetWorkflowResponse; workflowId: string }) {
  const stepsCount = Object.keys(workflow.steps ?? {}).length;

  return (
    <div className="flex w-full items-center gap-2 px-5">
      <Icon className="text-muted-foreground shrink-0">
        <WorkflowIcon />
      </Icon>
      <Txt as="span" variant="subheading" className="text-foreground truncate">
        {workflow.name ?? workflowId}
      </Txt>
      <CopyButton content={workflow.name ?? workflowId} variant="ghost" className="shrink-0" />
      <Badge className="ml-auto shrink-0">
        {stepsCount} step{stepsCount === 1 ? '' : 's'}
      </Badge>
    </div>
  );
}
