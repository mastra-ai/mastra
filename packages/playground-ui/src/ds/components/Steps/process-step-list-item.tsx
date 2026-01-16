import { cn } from '@/lib/utils';
import { getStatusIcon } from './shared';
import type { ProcessStep } from './shared';

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
      className={cn('grid gap-6 grid-cols-[1fr_auto] py-3 px-4 rounded-lg', {
        'border border-dashed border-gray-500': isActive,
      })}
    >
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <span className="text-ui-md text-neutral5 min-w-6 flex justify-end">{position}.</span>
        <div>
          <h4 className="text-ui-md text-neutral5">{formatStepTitle(stepId)}</h4>
          {step.description && <p className="text-ui-md -mt-0.5">{step.description}</p>}
        </div>
      </div>
      <div
        className={cn('w-[1.75rem] h-[1.75rem] rounded-full flex items-center justify-center self-center', {
          'border border-gray-500 border-dashed': step.status === 'pending',
          '[&>svg]:text-white [&>svg]:w-[1rem] [&>svg]:h-[1rem]': step.status !== 'running',
          'w-[1.75rem] h-[1.75rem]': step.status === 'running',
          'bg-green-900': step.status === 'success',
          'bg-red-900': step.status === 'failed',
        })}
      >
        {getStatusIcon(step.status)}
      </div>
    </div>
  );
}
