import { OnboardingNextRow } from './OnboardingStepRow';
import type { ChangeSectionProps } from './OnboardingStepRow';
import { OnboardingWorkDoneRow } from './OnboardingWorkDoneRow';

/** Work while closed: the connected sources once the user moved past Work, or a preview before that. */
export function OnboardingWorkRow({ confirmed, ...change }: ChangeSectionProps & { confirmed: boolean }) {
  if (!confirmed) return <OnboardingNextRow section="project-management" hint="Linear, Jira or incident.io" />;
  return <OnboardingWorkDoneRow {...change} />;
}
