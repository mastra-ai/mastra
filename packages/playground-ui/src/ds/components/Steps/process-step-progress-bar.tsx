import type { ProcessStep } from './shared';
import { Spinner } from '@/ds/components/Spinner';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type ProcessStepProgressBarProps = {
  steps: ProcessStep[];
};

export function ProcessStepProgressBar({ steps }: ProcessStepProgressBarProps) {
  const totalSteps = steps.length;
  const completedSteps = steps.filter(step => step.status === 'success').length;

  return (
    <div className="flex w-full flex-col content-center justify-center gap-4">
      <div className="grid w-full grid-cols-[0_repeat(9,1fr)]">
        {steps.map((step: ProcessStep, idx: number) => {
          return (
            <div
              key={step.id}
              className={cn('relative flex h-8 items-center justify-end', transitions.colors, {
                'bg-accent1Dark': step.status === 'success' && steps?.[idx - 1]?.status === 'success',
              })}
            >
              <div
                className={cn(
                  'absolute right-0 z-10 flex size-[2rem] translate-x-[50%] items-center justify-center self-center rounded-full bg-surface3 text-ui-sm font-bold text-neutral3',
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
      <div className={cn('text-center text-xs text-neutral3', transitions.colors)}>
        {completedSteps} of {totalSteps} steps completed
      </div>
    </div>
  );
}
