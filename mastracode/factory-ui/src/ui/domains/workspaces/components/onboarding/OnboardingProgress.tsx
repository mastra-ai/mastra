import { Txt } from '@mastra/playground-ui/components/Txt';
import type { OnboardingStep } from '../../services/onboardingFlow';
import { onboardingSteps, STEP_META } from '../../services/onboardingSteps';

export function OnboardingProgress({
  step,
  editingReview,
  local = false,
}: {
  step: OnboardingStep;
  editingReview: boolean;
  local?: boolean;
}) {
  const steps: OnboardingStep[] = onboardingSteps(undefined, local).filter(item => item !== 'initial');
  const activeStep = step === 'personal-provider' ? 'model-provider' : step;
  const progressIndex = editingReview ? steps.length - 1 : steps.indexOf(activeStep);
  return (
    <footer className="bg-background fixed inset-x-0 bottom-0 z-20 px-6 pt-4 pb-5 sm:px-10 lg:px-12 xl:px-16">
      <ol className="grid auto-cols-fr grid-flow-col gap-3 sm:gap-5" aria-label="Factory setup progress">
        {steps.map((item, index) => (
          <li key={item} aria-current={item === activeStep ? 'step' : undefined}>
            <div className="bg-fill h-0.5 overflow-hidden rounded-full" aria-hidden="true">
              <div
                className="onboarding-progress-fill bg-fill-inverse h-full"
                style={{ transform: `scaleX(${index <= progressIndex ? 1 : 0})` }}
              />
            </div>
            <Txt variant="meta" tone={item === activeStep ? 'ink' : 'muted'} className="mt-2">
              {STEP_META[item].label}
            </Txt>
          </li>
        ))}
      </ol>
    </footer>
  );
}
