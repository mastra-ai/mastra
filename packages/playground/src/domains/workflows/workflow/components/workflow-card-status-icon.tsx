import { Icon } from '@mastra/playground-ui/icons/Icon';
import { CircleCheck, CircleDashed, CircleX, HourglassIcon, Loader2, PauseIcon, ShieldAlert } from 'lucide-react';

import type { WorkflowCardDisplayStatus } from './types';

export interface WorkflowCardStatusIconProps {
  displayStatus?: WorkflowCardDisplayStatus;
  hasStep?: boolean;
}

export const WorkflowCardStatusIcon = ({ displayStatus, hasStep }: WorkflowCardStatusIconProps) => {
  const strokeWidth = 2;

  return (
    <Icon size="sm" className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
      {displayStatus === 'tripwire' && <ShieldAlert className="text-amber-400" strokeWidth={strokeWidth} />}
      {displayStatus === 'failed' && <CircleX className="text-accent2" strokeWidth={strokeWidth} />}
      {displayStatus === 'success' && <CircleCheck className="text-accent1" strokeWidth={strokeWidth} />}
      {displayStatus === 'suspended' && <PauseIcon className="text-accent3" strokeWidth={strokeWidth} />}
      {displayStatus === 'waiting' && <HourglassIcon className="text-accent5" strokeWidth={strokeWidth} />}
      {displayStatus === 'running' && <Loader2 className="text-accent6 animate-spin" strokeWidth={strokeWidth} />}
      {!displayStatus && !hasStep && <CircleDashed className="text-neutral2" strokeWidth={strokeWidth} />}
    </Icon>
  );
};
