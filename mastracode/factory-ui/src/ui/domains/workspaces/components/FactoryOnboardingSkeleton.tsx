import { readOnboardingDraft, readOnboardingStep } from '../services/onboardingFlow';
import { restoredOnboardingStep } from '../services/onboardingSteps';
import { OnboardingAccountsNextRow } from './onboarding/OnboardingAccountsRow';
import { OnboardingCodebaseRow } from './onboarding/OnboardingCodebaseRow';
import { OnboardingFrame } from './onboarding/OnboardingFrame';
import { OnboardingHostRowsSkeleton } from './onboarding/OnboardingHostRowsSkeleton';
import { OnboardingModelSectionSkeleton } from './onboarding/OnboardingModelSection';
import { OnboardingSlot } from './onboarding/OnboardingSlot';
import { OnboardingStepCard } from './onboarding/OnboardingStepCard';
import { OnboardingNextRow } from './onboarding/OnboardingStepRow';
import { OnboardingWorkRow } from './onboarding/OnboardingWorkRow';
import { ProjectManagementFactoryStep } from './ProjectManagementFactoryStep';

function OnboardingStepsSkeleton({ label }: { label: string }) {
  const draft = readOnboardingDraft();
  const openStep = restoredOnboardingStep(readOnboardingStep(), draft);

  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      <OnboardingSlot>
        {openStep === 'vcs' ? (
          <OnboardingStepCard section="vcs">
            <OnboardingHostRowsSkeleton label="Loading source control status" />
          </OnboardingStepCard>
        ) : (
          <div inert>
            <OnboardingCodebaseRow repository={draft.repository} onChange={() => undefined} changeDisabled={false} />
          </div>
        )}
      </OnboardingSlot>
      <OnboardingSlot>
        {openStep === 'project-management' ? (
          <div inert>
            <ProjectManagementFactoryStep
              onConnect={() => undefined}
              onContinue={() => undefined}
              repository={draft.repository}
              codeHostSync={draft.codeHostSync}
            />
          </div>
        ) : (
          <div inert>
            <OnboardingWorkRow
              confirmed={draft.workConfirmed === true}
              repository={draft.repository}
              codeHostSync={draft.codeHostSync}
              onChange={() => undefined}
              changeDisabled={false}
            />
          </div>
        )}
      </OnboardingSlot>
      <OnboardingSlot>
        {openStep === 'model' ? (
          <OnboardingModelSectionSkeleton />
        ) : (
          <>
            <OnboardingAccountsNextRow />
            <OnboardingNextRow section="model" />
          </>
        )}
      </OnboardingSlot>
    </div>
  );
}

export function FactoryOnboardingSkeleton({ label }: { label: string }) {
  return (
    <OnboardingFrame>
      <OnboardingStepsSkeleton label={label} />
    </OnboardingFrame>
  );
}
