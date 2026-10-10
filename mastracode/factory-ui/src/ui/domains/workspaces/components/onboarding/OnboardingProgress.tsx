import { Txt } from '@mastra/playground-ui/components/Txt';
import { ONBOARDING_STEPS, type OnboardingStep } from '../../services/onboardingFlow';
import { STEP_META } from '../../services/onboardingSteps';

const PROGRESS_STEPS: OnboardingStep[] = ONBOARDING_STEPS.filter(step => step !== 'initial');

export function OnboardingProgress({ step, editingReview }: { step: OnboardingStep; editingReview: boolean }) {
  const progressIndex = editingReview ? PROGRESS_STEPS.length - 1 : PROGRESS_STEPS.indexOf(step);
  return (
    <footer className="bg-background fixed inset-x-0 bottom-0 z-20 px-6 pt-4 pb-5 sm:px-10 lg:px-12 xl:px-16">
      <ol className="grid grid-cols-5 gap-3 sm:gap-5" aria-label="Factory setup progress">
        {PROGRESS_STEPS.map((item, index) => (
          <li key={item} aria-current={item === step ? 'step' : undefined}>
            <div className="bg-fill h-0.5 overflow-hidden rounded-full" aria-hidden="true">
              <div
                className="onboarding-progress-fill bg-fill-inverse h-full"
                style={{ transform: `scaleX(${index <= progressIndex ? 1 : 0})` }}
              />
            </div>
            <Txt variant="meta" tone={item === step ? 'ink' : 'muted'} className="mt-2">
              {STEP_META[item].label}
            </Txt>
          </li>
        ))}
      </ol>
    </footer>
  );
}
