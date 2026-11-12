import type { OnboardingModelSetup } from '../../hooks/useOnboardingModelSetup';
import { modelSectionIndex } from '../../services/onboardingSteps';
import { OnboardingDoneRow, OnboardingNextRow } from './OnboardingStepRow';
import type { ChangeSectionProps } from './OnboardingStepRow';

/** The model Create would submit: the personal lane's on Personal accounts, the company lane's otherwise. */
function submittedModelId(setup: OnboardingModelSetup): string | undefined {
  if (setup.scope === 'user') return setup.personal.choice?.modelId;
  return setup.company.choice?.modelId;
}

/** Model while closed: the model Create would submit, or a preview before that. Third in local mode. */
export function OnboardingModelRow({
  setup,
  local,
  ...change
}: ChangeSectionProps & { setup: OnboardingModelSetup; local: boolean }) {
  if (!setup.canCreate) {
    const hint = setup.company.connection.gatewayProvider ? 'Mastra Gateway or your own provider' : 'Your own provider';
    return <OnboardingNextRow section="model" index={modelSectionIndex(local)} hint={hint} />;
  }
  return <OnboardingDoneRow section="model" value={submittedModelId(setup)} {...change} />;
}
