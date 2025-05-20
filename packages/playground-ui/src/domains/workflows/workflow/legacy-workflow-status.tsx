import { Txt } from '@/ds/components/Txt';
import { CheckIcon, CrossIcon, Icon } from '@/ds/icons';
import { Loader2 } from 'lucide-react';
import { WorkflowCard } from './workflow-card';

export interface LegacyWorkflowStatusProps {
  stepId: string;
  pathStatus: string;
  path: string;
}

export const LegacyWorkflowStatus = ({ stepId, pathStatus, path }: LegacyWorkflowStatusProps) => {
  const status =
    pathStatus === 'completed'
      ? 'Completed'
      : stepId === path
        ? pathStatus.charAt(0).toUpperCase() + pathStatus.slice(1)
        : pathStatus === 'executing'
          ? 'Executing'
          : 'Completed';

  return (
    <WorkflowCard
      header={
        <div className="flex items-center gap-3">
          <Icon>
            {status === 'Completed' && <CheckIcon className="text-accent1" />}
            {status === 'Failed' && <CrossIcon className="text-accent2" />}
            {status === 'Executing' && <Loader2 className="text-icon3 animate-spin" />}
          </Icon>
          <Txt as="span" variant="ui-lg" className="text-icon6 font-medium">
            {path}
          </Txt>
        </div>
      }
    />
  );
};
