import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { EmptyFactoryState } from '../domains/workspaces';
import { callbackResult, GitHubAppCallbackHandler } from '../domains/workspaces/components/GitHubAppCallbackHandler';

export const OnboardingPage = () => {
  const [searchParams] = useSearchParams();
  // Read once on arrival: the handler strips the params right after, and the result stays until dismissed.
  const [githubCallback, setGithubCallback] = useState(() => callbackResult(searchParams));
  return (
    <>
      <GitHubAppCallbackHandler inline />
      <EmptyFactoryState githubCallback={githubCallback} onDismissGithubCallback={() => setGithubCallback(undefined)} />
    </>
  );
};
