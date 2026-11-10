import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { CirclePause } from 'lucide-react';
import { workflowStatusTone, workflowStatusToneText } from '../workflow-status-tone';
import { Spinner } from '@/ds/components/Spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { IconCheckmark1 } from '@/ds/icons/central/IconCheckmark1';
import { IconCircleBanSign } from '@/ds/icons/central/IconCircleBanSign';
import { IconClock } from '@/ds/icons/central/IconClock';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';
import { IconPause } from '@/ds/icons/central/IconPause';
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
      return <IconCrossMedium className={toneText} />;
    case 'canceled':
      return <IconCircleBanSign className={toneText} />;
    case 'pending':
    case 'waiting':
      return <IconClock className={toneText} />;
    case 'paused':
      return <IconPause className={toneText} />;
    case 'suspended':
      return <CirclePause className={toneText} />;
    case 'success':
      return <IconCheckmark1 className={toneText} />;
    default:
      return <IconClock className={toneText} />;
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
