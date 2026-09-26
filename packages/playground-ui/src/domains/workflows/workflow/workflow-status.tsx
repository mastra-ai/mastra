import { CirclePause, HourglassIcon, Loader2, ShieldAlert } from 'lucide-react';
import { WorkflowCard } from './workflow-card';
import { TripwireNotice } from '@/domains/chat/messages/tripwire-notice';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Txt } from '@/ds/components/Txt';
import { CheckIcon } from '@/ds/icons/CheckIcon';
import { CrossIcon } from '@/ds/icons/CrossIcon';
import { Icon } from '@/ds/icons/Icon';

export interface TripwireInfo {
  reason?: string;
  retry?: boolean;
  metadata?: unknown;
  processorId?: string;
}

export interface WorkflowStatusProps {
  stepId: string;
  status: string;
  result: Record<string, unknown>;
  tripwire?: TripwireInfo;
}

export const WorkflowStatus = ({ stepId, status, result, tripwire }: WorkflowStatusProps) => {
  const isTripwire = status === 'tripwire';

  return (
    <WorkflowCard
      header={
        <div className="flex items-center gap-3">
          <Icon>
            {status === 'success' && <CheckIcon className="text-success-fg" />}
            {status === 'failed' && <CrossIcon className="text-destructive-fg" />}
            {status === 'tripwire' && <ShieldAlert className="text-warning-fg" />}
            {status === 'suspended' && <CirclePause className="text-info-fg" />}
            {status === 'waiting' && <HourglassIcon className="text-info-fg" />}
            {status === 'running' && <Loader2 className="animate-spin text-warning-fg" />}
          </Icon>
          <Txt as="span" variant="heading" tone="ink">
            {stepId.charAt(0).toUpperCase() + stepId.slice(1)}
          </Txt>
        </div>
      }
    >
      {isTripwire && tripwire ? (
        <TripwireNotice reason={tripwire.reason || 'Tripwire triggered'} tripwire={tripwire} />
      ) : (
        <CodeEditor data={result} />
      )}
    </WorkflowCard>
  );
};
