import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { FactoryOnboarding } from './FactoryOnboarding';
import type { GitHubAppCallbackResult } from './GitHubAppCallbackHandler';

export function EmptyFactoryState({
  githubCallback,
  onDismissGithubCallback,
}: {
  githubCallback?: GitHubAppCallbackResult;
  onDismissGithubCallback: () => void;
}) {
  const auth = useFactoryAuth();
  if (auth.isPending) return <SkeletonRows label="Loading Factory setup" rows={3} />;
  // A failed background refetch keeps the form and its open dialogs; only a first load with no account blocks.
  if (!auth.data)
    return (
      <div className="p-6">
        <Txt role="alert">Unable to load your account.</Txt>
        <Button onClick={() => void auth.refetch()}>Retry</Button>
      </div>
    );
  return (
    <FactoryOnboarding
      local={!auth.data.authEnabled}
      githubCallback={githubCallback}
      onDismissGithubCallback={onDismissGithubCallback}
    />
  );
}
