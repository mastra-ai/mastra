import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useGithubStatusQuery } from '../../../../../shared/hooks/useGithubStatus';
import { isGithubAvailable } from '../deriveFactoryOnboardingOpen';

/** Factory onboarding shown when no factory is active yet. */
export function EmptyFactoryState({
  onConnectGithub,
  onOpenLocal,
}: {
  onConnectGithub: () => void;
  onOpenLocal: () => void;
}) {
  const githubQuery = useGithubStatusQuery();
  const statusSettled = !githubQuery.isPending && (githubQuery.isFetched || githubQuery.isError);
  const githubAvailable = isGithubAvailable(githubQuery.data);

  return (
    <div className="m-auto flex max-w-md flex-col items-center gap-3 px-6 text-center">
      <Txt as="h2" variant="header-md" className="text-icon6">
        Welcome to MastraCode
      </Txt>
      <Txt as="p" variant="ui-md" className="max-w-sm text-icon3">
        Connect a GitHub repository to start a coding session, or create a Factory from a local folder. Each Factory
        keeps its own threads, memory, and workspace — shared with the terminal.
      </Txt>
      {!statusSettled ? null : githubAvailable ? (
        <div className="mt-2 flex flex-col items-center gap-2">
          <Button variant="primary" onClick={onConnectGithub}>
            Connect GitHub
          </Button>
          <Button variant="outline" onClick={onOpenLocal}>
            Create factory from local folder
          </Button>
        </div>
      ) : (
        <Button variant="primary" className="mt-2" onClick={onOpenLocal}>
          Create factory from local folder
        </Button>
      )}
    </div>
  );
}
