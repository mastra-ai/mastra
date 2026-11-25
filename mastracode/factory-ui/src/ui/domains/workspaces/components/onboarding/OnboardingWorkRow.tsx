import type { SourceControlRepository } from '../../services/github';
import { OnboardingNextRow } from './OnboardingStepRow';
import type { ChangeSectionProps } from './OnboardingStepRow';
import { OnboardingWorkDoneRow } from './OnboardingWorkDoneRow';

export interface OnboardingWorkRowProps extends ChangeSectionProps {
  confirmed: boolean;
  /** Work summarises the codebase step's repository beside the connected trackers. */
  repository?: SourceControlRepository;
  codeHostSync?: boolean;
}

/** Work while closed: the connected sources once the user moved past Work, or a preview before that. */
export function OnboardingWorkRow({ confirmed, repository, codeHostSync, ...change }: OnboardingWorkRowProps) {
  if (!confirmed) {
    return <OnboardingNextRow section="project-management" hint="GitHub, GitLab, Linear, Jira or incident.io" />;
  }
  return <OnboardingWorkDoneRow repository={repository} codeHostSync={codeHostSync} {...change} />;
}
