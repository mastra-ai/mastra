import { Txt } from '@/ds/components/Txt';
import { CheckIcon, CrossIcon, Icon } from '@/ds/icons';
import { CirclePause, Loader2 } from 'lucide-react';
import { WorkflowCard } from './workflow-card';

export interface WorkflowStatusProps {
  stepId: string;
  status: string;
}

export const WorkflowStatus = ({ stepId, status }: WorkflowStatusProps) => {
  return (
    <WorkflowCard
      header={
        <div className="flex items-center gap-3">
          <Icon>
            {status === 'success' && <CheckIcon className="text-accent1" />}
            {status === 'failed' && <CrossIcon className="text-accent2" />}
            {status === 'suspended' && <CirclePause className="text-icon3" />}
            {status === 'running' && <Loader2 className="text-icon3 animate-spin" />}
          </Icon>
          <Txt as="span" variant="ui-lg" className="text-icon6 font-medium">
            {stepId.charAt(0).toUpperCase() + stepId.slice(1)}
          </Txt>
        </div>
      }
    />
  );
};
