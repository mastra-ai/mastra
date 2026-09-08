import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { CheckIcon } from '@mastra/playground-ui/icons/CheckIcon';
import { CrossIcon } from '@mastra/playground-ui/icons/CrossIcon';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { CirclePause, HourglassIcon, Loader2, ShieldAlert } from 'lucide-react';
import { WorkflowCard } from './workflow-card';
import { TripwireNotice } from '@/lib/ai-ui/messages/tripwire-notice';

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
            {status === 'success' && <CheckIcon className="text-accent1" />}
            {status === 'failed' && <CrossIcon className="text-accent2" />}
            {status === 'tripwire' && <ShieldAlert className="text-notice-warning-fg" />}
            {status === 'suspended' && <CirclePause className="text-accent3" />}
            {status === 'waiting' && <HourglassIcon className="text-accent5" />}
            {status === 'running' && <Loader2 className="text-accent6 animate-spin" />}
          </Icon>
          <Txt as="span" variant="ui-lg" className="text-neutral6 font-medium">
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
