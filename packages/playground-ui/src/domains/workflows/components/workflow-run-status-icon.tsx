import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { Check, CirclePause, CircleSlash, Clock, Pause, X } from 'lucide-react';
import { Spinner } from '@/ds/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';

export interface WorkflowRunStatusIconProps {
  status: WorkflowRunStatus;
}

function StatusIcon({ status }: WorkflowRunStatusIconProps) {
  switch (status) {
    case 'running':
      return <Spinner />;
    case 'failed':
      return <X className="text-destructive-indicator" />;
    case 'canceled':
      return <CircleSlash className="text-muted-foreground" />;
    case 'pending':
    case 'waiting':
      return <Clock className="text-muted-foreground" />;
    case 'paused':
      return <Pause className="text-warning-indicator" />;
    case 'suspended':
      return <CirclePause className="text-info-indicator" />;
    case 'success':
      return <Check className="text-success-indicator" />;
    default:
      return <Clock className="text-muted-foreground" />;
  }
}

export function WorkflowRunStatusIcon({ status }: WorkflowRunStatusIconProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Icon aria-label={status} className="shrink-0">
          <StatusIcon status={status} />
        </Icon>
      </TooltipTrigger>
      <TooltipContent>{status}</TooltipContent>
    </Tooltip>
  );
}
