import type { OnboardingModelSetup } from '../../hooks/useOnboardingModelSetup';
import { SETUP_LABELS } from '../../services/onboardingSteps';
import { OnboardingDoneRow, OnboardingNextRow } from './OnboardingStepRow';
import type { ChangeSectionProps } from './OnboardingStepRow';

/** Accounts while closed: who pays once Create is possible, or a preview before that. Opens the Model step. */
export function OnboardingAccountsRow({ setup, ...change }: ChangeSectionProps & { setup: OnboardingModelSetup }) {
  if (!setup.canCreate) return <OnboardingNextRow section="accounts" hint="Company or personal accounts" />;
  return <OnboardingDoneRow section="accounts" value={SETUP_LABELS[setup.scope]} {...change} />;
}
