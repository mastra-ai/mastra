import { cn } from '@/lib/utils';
import { getStatusIcon } from './shared';
import type { ProcessStep } from './shared';

type ProcessStepListItemProps = {
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
      className={cn('grid gap-[1.5rem] grid-cols-[1fr_auto] py-[.75rem] px-[1rem] rounded-lg', {
        'border border-dashed border-gray-500': isActive,
      })}
    >
      <div className="grid grid-cols-[auto_1fr] gap-[.5rem]">
        <span className="text-[0.875rem] text-icon5 min-w-[1.5rem] flex justify-end">{position}.</span>
        <div>
          <h4 className="text-[0.875rem] text-icon5">{formatStepTitle(stepId)}</h4>
          {step.description && <p className="text-[0.875rem] -mt-[0.125rem]">{step.description}</p>}
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
