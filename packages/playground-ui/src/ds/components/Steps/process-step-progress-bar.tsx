import { cn } from '@/lib/utils';
import { Spinner } from '@/ds/components/Spinner';
import { type ProcessStep } from './shared';
import { transitions } from '@/ds/primitives/transitions';

export type ProcessStepProgressBarProps = {
  steps: ProcessStep[];
};

export function ProcessStepProgressBar({ steps }: ProcessStepProgressBarProps) {
  const totalSteps = steps.length;
  const completedSteps = steps.filter(step => step.status === 'success').length;

  return (
    <div className="flex justify-center flex-col gap-4 content-center w-full">
      <div className="grid grid-cols-[0_repeat(9,1fr)] w-full">
        {steps.map((step: ProcessStep, idx: number) => {
          return (
            <div
              key={step.id}
              className={cn('flex justify-end items-center relative h-[2rem]', transitions.colors, {
                'bg-accent1Dark': step.status === 'success' && steps?.[idx - 1]?.status === 'success',
              })}
            >
              <div
                className={cn(
                  'w-[2rem] h-[2rem] rounded-full flex items-center justify-center self-center absolute right-0 translate-x-[50%] bg-surface3 z-10 text-neutral3 font-bold text-ui-sm',
                  transitions.all,
                  {
                    'border border-neutral2 border-dashed': step.status === 'pending',
                    '[&>svg]:text-surface1 [&>svg]:w-[1.1rem] [&>svg]:h-[1.1rem]': step.status !== 'running',
                    'bg-accent1Dark text-white shadow-glow-accent1 scale-110': step.status === 'success',
                    'bg-accent2Dark text-white shadow-glow-accent2 scale-110': step.status === 'failed',
                  },
                )}
              >
                {step.status === 'running' ? <Spinner /> : idx + 1}
              </div>
            </div>
          );
        })}
      </div>
      <div className={cn('text-xs text-neutral3 text-center', transitions.colors)}>
        {completedSteps} of {totalSteps} steps completed
      </div>
    </div>
  );
}
