import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { Check, CirclePause, CircleSlash, Clock, Pause, X } from 'lucide-react';

export interface WorkflowRunStatusIconProps {
  status: WorkflowRunStatus;
}

function StatusIcon({ status }: WorkflowRunStatusIconProps) {
  switch (status) {
    case 'running':
      return <Spinner />;
    case 'failed':
      return <X className="text-accent2" />;
    case 'canceled':
      return <CircleSlash className="text-muted-foreground" />;
    case 'pending':
    case 'waiting':
      return <Clock className="text-muted-foreground" />;
    case 'paused':
      return <Pause className="text-badge-yellow-fg" />;
    case 'suspended':
      return <CirclePause className="text-accent3" />;
    case 'success':
      return <Check className="text-accent1" />;
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
