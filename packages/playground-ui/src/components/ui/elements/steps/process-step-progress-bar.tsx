import { cn } from '@/lib/utils';
import Spinner from '../../spinner';
import { type ProcessStep } from './shared';

export function ProcessStepProgressBar({ steps }: { steps: ProcessStep[] }) {
  const totalSteps = steps.length;
  const completedSteps = steps.filter(step => step.status === 'success').length;

  return (
    <div className="flex justify-center flex-col gap-[1rem] content-center w-full">
      <div className="grid grid-cols-[0_repeat(9,1fr)] w-full">
        {steps.map((step: ProcessStep, idx: number) => {
          return (
            <div
              key={step.id}
              className={cn('flex justify-end items-center relative h-[2rem] ', {
                'bg-green-900': step.status === 'success' && steps?.[idx - 1]?.status === 'success',
              })}
            >
              <div
                className={cn(
                  'w-[2rem] h-[2rem] rounded-full flex items-center justify-center self-center absolute right-0 translate-x-[50%] bg-surface3 z-10 text-icon3 font-bold text-[0.75rem]',
                  {
                    'border border-gray-500 border-dashed': step.status === 'pending',
                    '[&>svg]:text-surface4 [&>svg]:w-[1.1rem] [&>svg]:h-[1.1rem]': step.status !== 'running',
                    'bg-green-900 text-white': step.status === 'success',
                    'bg-red-900 text-white': step.status === 'failed',
                  },
                )}
              >
                {step.status === 'running' ? <Spinner /> : idx + 1}
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-icon3 text-center">
        {completedSteps} of {totalSteps} steps completed
      </div>
    </div>
  );
}
