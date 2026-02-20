import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/Tooltip';
import { CheckIcon, Loader2, HourglassIcon, PauseIcon, X, CircleDashed } from 'lucide-react';
import { WorkflowStatusType } from '../types';
import { useWorkflowStatus } from '../context';
import { Icon } from '@/ui/Icon';

const StepIcons: Record<WorkflowStatusType, React.ReactNode> = {
  failed: <X className="mastra:text-accent2" />,
  success: <CheckIcon className="mastra:text-accent1" />,
  suspended: <PauseIcon className="mastra:text-accent3" />,
  waiting: <HourglassIcon className="mastra:text-accent5" />,
  running: <Loader2 className="mastra:text-accent6 mastra:animate-spin" />,
  idle: <CircleDashed className="mastra:text-text3" />,
};

export const StepStatusClass = 'mastra:text-sm mastra:text-text6';
export const StepStatus = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const status = useWorkflowStatus();
  const icon = StepIcons[status];

  return (
    <Tooltip>
      <TooltipTrigger>
        <div className={className || StepStatusClass} {...props}>
          <Icon>{icon}</Icon>
        </div>
      </TooltipTrigger>

      <TooltipContent>{status}</TooltipContent>
    </Tooltip>
  );
};
