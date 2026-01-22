import { cn } from '@/lib/utils';
import { getStatusIcon } from './shared';
import type { ProcessStep } from './shared';
import { transitions } from '@/ds/primitives/transitions';

export type ProcessStepListItemProps = {
  stepId: string;
  step: ProcessStep;
  isActive: boolean;
  position: number;
};

export function ProcessStepListItem({ stepId, step, isActive, position }: ProcessStepListItemProps) {
  // Always format the step ID as the title
  const formatStepTitle = (stepId: string) => {
    return stepId.charAt(0).toUpperCase() + stepId.slice(1).replace(/-/g, ' ');
  };

  return (
    <div
      className={cn('grid gap-6 grid-cols-[1fr_auto] py-3 px-4 rounded-lg', transitions.all, {
        'border border-dashed border-neutral2 bg-surface3': isActive,
      })}
    >
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <span
          className={cn('text-ui-md min-w-6 flex justify-end', transitions.colors, {
            'text-neutral5': isActive || step.status === 'success',
            'text-neutral3': !isActive && step.status !== 'success',
          })}
        >
          {position}.
        </span>
        <div>
          <h4
            className={cn('text-ui-md', transitions.colors, {
              'text-neutral5': isActive || step.status === 'success',
              'text-neutral3': !isActive && step.status !== 'success',
            })}
          >
            {formatStepTitle(stepId)}
          </h4>
          {step.description && <p className="text-ui-md text-neutral2 -mt-0.5">{step.description}</p>}
        </div>
      </div>
      <div
        className={cn(
          'w-[1.75rem] h-[1.75rem] rounded-full flex items-center justify-center self-center',
          transitions.all,
          {
            'border border-neutral2 border-dashed': step.status === 'pending',
            '[&>svg]:text-white [&>svg]:w-[1rem] [&>svg]:h-[1rem]': step.status !== 'running',
            'w-[1.75rem] h-[1.75rem]': step.status === 'running',
            'bg-accent1Dark shadow-glow-accent1': step.status === 'success',
            'bg-accent2Dark shadow-glow-accent2': step.status === 'failed',
            'scale-110': step.status === 'success' || step.status === 'failed',
          },
        )}
      >
        {getStatusIcon(step.status)}
      </div>
    </div>
  );
}
