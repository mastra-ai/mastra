import { ProcessStepListItem } from './process-step-list-item';
import type { ProcessStep } from './shared';
import { cn } from '@/lib/utils';

export type ProcessStepListProps = {
  currentStep: ProcessStep | null;
  steps: ProcessStep[];
  className?: string;
};

export function ProcessStepList({ currentStep, steps = [], className }: ProcessStepListProps) {
  return (
    <div className={cn(className)}>
      {steps.map((step: ProcessStep, idx: number) => (
        <ProcessStepListItem
          key={step.id}
          stepId={step.id}
          step={step}
          isActive={currentStep?.id === step.id}
          position={idx + 1}
        />
      ))}
    </div>
  );
}
