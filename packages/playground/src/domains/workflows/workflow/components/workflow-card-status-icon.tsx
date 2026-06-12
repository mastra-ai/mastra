import { CheckIcon, CrossIcon, Icon } from '@mastra/playground-ui';
import { CircleDashed, HourglassIcon, Loader2, PauseIcon, ShieldAlert } from 'lucide-react';

import type { WorkflowCardDisplayStatus } from './types';

export interface WorkflowCardStatusIconProps {
  displayStatus?: WorkflowCardDisplayStatus;
  hasStep?: boolean;
}

export const WorkflowCardStatusIcon = ({ displayStatus, hasStep }: WorkflowCardStatusIconProps) => (
  <Icon>
    {displayStatus === 'tripwire' && <ShieldAlert className="text-amber-400" />}
    {displayStatus === 'failed' && <CrossIcon className="text-accent2" />}
    {displayStatus === 'success' && <CheckIcon className="text-accent1" />}
    {displayStatus === 'suspended' && <PauseIcon className="text-accent3" />}
    {displayStatus === 'waiting' && <HourglassIcon className="text-accent5" />}
    {displayStatus === 'running' && <Loader2 className="text-accent6 animate-spin" />}
    {!hasStep && <CircleDashed className="text-neutral2" />}
  </Icon>
);
