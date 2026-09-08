import { Badge } from '@mastra/playground-ui/components/Badge';
import { EntityHeader } from '@mastra/playground-ui/components/EntityHeader';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { CopyIcon, Cpu, Database } from 'lucide-react';

import { useWorkflow } from '@/hooks/use-workflows';

export interface WorkflowEntityHeaderProps {
  workflowId: string;
}

export const WorkflowEntityHeader = ({ workflowId }: WorkflowEntityHeaderProps) => {
  const { data: workflow, isLoading } = useWorkflow(workflowId);
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
                <Badge icon={<CopyIcon />}>{workflowId}</Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent>Copy Workflow ID for use in code</TooltipContent>
          </Tooltip>

          <Badge>
            {stepsCount} step{stepsCount === 1 ? '' : 's'}
          </Badge>

          {workflow?.isProcessorWorkflow && (
            <Badge icon={<Cpu />} variant="purple">
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
                className="focus-visible:outline-neutral5/55 rounded-[7px] focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-solid"
              >
                <Badge icon={<Database />} variant="blue">
                  Dynamic
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Registered via the dynamic-workflows API — lives in storage</TooltipContent>
            </Tooltip>
          )}
        </div>
      </EntityHeader>
    </TooltipProvider>
  );
};
