import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { FactoryOnboarding } from './FactoryOnboarding';
import { FactoryOnboardingSkeletonContent } from './FactoryOnboardingSkeleton';
import type { GitHubAppCallbackResult } from './GitHubAppCallbackHandler';
import { OnboardingFrame } from './onboarding/OnboardingFrame';

export function EmptyFactoryState({
  githubCallback,
  onDismissGithubCallback,
}: {
  githubCallback?: GitHubAppCallbackResult;
  onDismissGithubCallback: () => void;
}) {
  const auth = useFactoryAuth();
  // A failed background refetch keeps the form and its open dialogs; only a first load with no account blocks.
  if (!auth.isPending && !auth.data)
    return (
      <div className="p-6">
        <Txt role="alert">Unable to load your account.</Txt>
        <Button onClick={() => void auth.refetch()}>Retry</Button>
      </div>
    );
  return (
    <OnboardingFrame>
      {auth.data ? (
        <FactoryOnboarding
          local={!auth.data.authEnabled}
          githubCallback={githubCallback}
          onDismissGithubCallback={onDismissGithubCallback}
        />
      ) : (
        <FactoryOnboardingSkeletonContent label="Loading Factory setup" />
      )}
    </OnboardingFrame>
  );
}
