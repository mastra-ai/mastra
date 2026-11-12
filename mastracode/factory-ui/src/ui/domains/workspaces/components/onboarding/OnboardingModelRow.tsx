import type { OnboardingModelSetup } from '../../hooks/useOnboardingModelSetup';
import { modelSectionIndex } from '../../services/onboardingSteps';
import { OnboardingDoneRow, OnboardingNextRow } from './OnboardingStepRow';
import type { ChangeSectionProps } from './OnboardingStepRow';

/** The models Create would submit: the personal lane's on Personal accounts, both lanes' (work, then sessions) in hybrid. */
function submittedModels(setup: OnboardingModelSetup): string | undefined {
  if (setup.scope === 'user') return setup.personal.choice?.modelId;
  const company = setup.company.choice?.modelId;
  if (setup.scope === 'hybrid' && company && setup.personal.choice)
    return `${company} · ${setup.personal.choice.modelId}`;
  return company;
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
  return <OnboardingDoneRow section="model" value={submittedModels(setup)} {...change} />;
}
