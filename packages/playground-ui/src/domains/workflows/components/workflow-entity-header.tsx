import { useWorkflow } from '@mastra/react/hooks/workflows';
import { Badge } from '@/ds/components/Badge';
import { EntityHeader } from '@/ds/components/EntityHeader';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { IconChip } from '@/ds/icons/central/IconChip';
import { IconServer1 } from '@/ds/icons/central/IconServer1';
import { IconSquareBehindSquare1 } from '@/ds/icons/central/IconSquareBehindSquare1';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { focusRing } from '@/ds/primitives/transitions';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/utils/cn';

export interface WorkflowEntityHeaderProps {
  requestContext?: Record<string, any>;
  workflowId: string;
}

export const WorkflowEntityHeader = ({ workflowId, requestContext }: WorkflowEntityHeaderProps) => {
  const { data: workflow, isLoading } = useWorkflow({
    workflowId: workflowId,
    requestContext: requestContext,
    queryOptions: { enabled: Boolean(workflowId) },
  });
  const { handleCopy } = useCopyToClipboard({ text: workflowId });

  const workflowName = workflow?.name || workflowId;
  const stepsCount = Object.keys(workflow?.steps ?? {}).length;

  return (
    <TooltipProvider>
      <EntityHeader icon={<WorkflowIcon />} title={workflowName} isLoading={isLoading}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={handleCopy} className="h-badge-default shrink-0">
                <Badge icon={<IconSquareBehindSquare1 />}>{workflowId}</Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent>Copy workflow ID for use in code</TooltipContent>
          </Tooltip>

          <Badge>
            {stepsCount} step{stepsCount === 1 ? '' : 's'}
          </Badge>

          {workflow?.isProcessorWorkflow && (
            <Badge icon={<IconChip />} variant="purple">
              Processor
            </Badge>
          )}

          {workflow?.origin === 'dynamic' && (
            <Tooltip>
              <TooltipTrigger
                render={<span />}
                role="note"
                tabIndex={0}
                aria-label="Dynamic workflow"
                className={cn('rounded-[7px]', focusRing)}
              >
                <Badge icon={<IconServer1 />} variant="blue">
                  Dynamic
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Registered via the dynamic-workflows API and saved in storage</TooltipContent>
            </Tooltip>
          )}
        </div>
      </EntityHeader>
    </TooltipProvider>
  );
};
