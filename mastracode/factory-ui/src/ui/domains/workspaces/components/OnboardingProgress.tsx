import { Txt } from '@mastra/playground-ui/components/Txt';
import type { OnboardingStep } from '../services/onboardingFlow';
import type { ModelSetupPreset } from '../services/modelSetupPreset';
import { onboardingProgress } from '../services/onboardingSteps';

export function OnboardingProgress({
  step,
  preset,
  editingReview,
}: {
  step: OnboardingStep;
  preset?: ModelSetupPreset;
  editingReview: boolean;
}) {
  const progressSteps = onboardingProgress(preset);
  const progressIndex = editingReview
    ? progressSteps.length - 1
    : progressSteps.findIndex(item => item.steps.includes(step));
  return (
    <footer className="bg-background fixed inset-x-0 bottom-0 z-20 px-6 pt-4 pb-5 sm:px-10 lg:px-12 xl:px-16">
      <ol className="grid grid-cols-5 gap-3 sm:gap-5" aria-label="Factory setup progress">
        {progressSteps.map((item, index) => {
          const active = item.steps.includes(step);
          return (
            <li key={item.label} aria-current={active ? 'step' : undefined}>
              <div className="bg-fill h-0.5 overflow-hidden rounded-full" aria-hidden="true">
                <div
                  className="onboarding-progress-fill bg-fill-inverse h-full"
                  style={{ transform: `scaleX(${index <= progressIndex ? 1 : 0})` }}
                />
              </div>
              <Txt variant="meta" tone={active ? 'ink' : 'muted'} className="mt-2">
                {item.label}
              </Txt>
            </li>
          );
        })}
      </ol>
    </footer>
  );
}
