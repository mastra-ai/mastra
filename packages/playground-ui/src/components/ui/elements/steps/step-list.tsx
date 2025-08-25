import { cn } from '@/lib/utils';
import { Step } from './shared';
import { StepListItem } from './step-list-item';

type StepListProps = {
  currentStep: any;
  steps: Step[];
  className?: string;
};

export function StepList({ currentStep, steps = [], className }: StepListProps) {
  return (
    <div className={cn(className)}>
      {steps.map((step: Step, idx: number) => (
        <StepListItem
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
