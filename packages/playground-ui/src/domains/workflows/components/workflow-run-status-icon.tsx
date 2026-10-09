import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { Check, CirclePause, CircleSlash, Clock, Pause, X } from 'lucide-react';
import { workflowStatusTone, workflowStatusToneText } from '../workflow-status-tone';
import { Spinner } from '@/ds/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';

export interface WorkflowRunStatusIconProps {
  status: WorkflowRunStatus;
}

function StatusIcon({ status }: WorkflowRunStatusIconProps) {
  const toneText = workflowStatusToneText[workflowStatusTone(status)];
  switch (status) {
    case 'running':
      return <Spinner />;
    case 'failed':
      return <X className={toneText} />;
    case 'canceled':
      return <CircleSlash className={toneText} />;
    case 'pending':
    case 'waiting':
      return <Clock className={toneText} />;
    case 'paused':
      return <Pause className={toneText} />;
    case 'suspended':
      return <CirclePause className={toneText} />;
    case 'success':
      return <Check className={toneText} />;
    default:
      return <Clock className={toneText} />;
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
