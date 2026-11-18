import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';

import { GitLabIcon } from '../../../../ui/icons';
import { OnboardingConnectionRowSkeleton } from './OnboardingConnectionSkeleton';
import { OnboardingInset } from './OnboardingInset';

export function OnboardingHostRowsSkeleton({ label }: { label: string }) {
  return (
    <OnboardingInset>
      <div role="status" aria-label={label} className="flex flex-col gap-0.5">
        <OnboardingConnectionRowSkeleton icon={<GithubIcon />} name="GitHub" />
        <OnboardingConnectionRowSkeleton icon={<GitLabIcon />} name="GitLab" />
      </div>
    </OnboardingInset>
  );
}
