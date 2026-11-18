import { readOnboardingDraft, readOnboardingStep } from '../services/onboardingFlow';
import { restoredOnboardingStep } from '../services/onboardingSteps';
import { OnboardingChoiceRowsSkeleton } from './onboarding/OnboardingChoiceRowsSkeleton';
import { OnboardingCodebaseRow } from './onboarding/OnboardingCodebaseRow';
import { OnboardingFrame } from './onboarding/OnboardingFrame';
import { OnboardingHostRowsSkeleton } from './onboarding/OnboardingHostRowsSkeleton';
import { OnboardingSlot } from './onboarding/OnboardingSlot';
import { OnboardingStepCard } from './onboarding/OnboardingStepCard';
import { OnboardingNextRow } from './onboarding/OnboardingStepRow';
import { OnboardingWorkRow } from './onboarding/OnboardingWorkRow';

export function FactoryOnboardingSkeleton({ label }: { label: string }) {
  const draft = readOnboardingDraft();
  const openStep = restoredOnboardingStep(readOnboardingStep(), draft);

  return (
    <OnboardingFrame>
      <div role="status" aria-label={label}>
        <div aria-hidden className="flex flex-col gap-2">
          <OnboardingSlot>
            {openStep === 'vcs' ? (
              <OnboardingStepCard section="vcs">
                <OnboardingHostRowsSkeleton label={label} />
              </OnboardingStepCard>
            ) : (
              <OnboardingCodebaseRow repository={draft.repository} onChange={() => undefined} changeDisabled />
            )}
          </OnboardingSlot>
          <OnboardingSlot>
            {openStep === 'project-management' ? (
              <OnboardingStepCard section="project-management">
                <OnboardingHostRowsSkeleton label={label} />
              </OnboardingStepCard>
            ) : draft.workConfirmed ? (
              <OnboardingNextRow section="project-management" />
            ) : (
              <OnboardingWorkRow confirmed={false} onChange={() => undefined} changeDisabled />
            )}
          </OnboardingSlot>
          <OnboardingSlot>
            {openStep === 'model' ? (
              <>
                <OnboardingStepCard section="accounts">
                  <OnboardingChoiceRowsSkeleton label={label} rows={3} />
                </OnboardingStepCard>
                <OnboardingStepCard section="model">
                  <OnboardingChoiceRowsSkeleton label="Loading model providers" rows={1} />
                </OnboardingStepCard>
              </>
            ) : (
              <>
                <OnboardingNextRow section="accounts" />
                <OnboardingNextRow section="model" />
              </>
            )}
          </OnboardingSlot>
        </div>
      </div>
    </OnboardingFrame>
  );
}
