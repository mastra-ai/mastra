import type { SourceControlRepository } from '../../services/github';
import { OnboardingDoneRow, OnboardingNextRow } from './OnboardingStepRow';
import type { ChangeSectionProps } from './OnboardingStepRow';

/** Codebase while closed: the picked repository and branch, or a preview until one is picked. */
export function OnboardingCodebaseRow({
  repository,
  ...change
}: ChangeSectionProps & { repository?: SourceControlRepository }) {
  if (!repository) return <OnboardingNextRow section="vcs" />;
  return (
    <OnboardingDoneRow section="vcs" value={repository.fullName} subValue={repository.defaultBranch} {...change} />
  );
}
