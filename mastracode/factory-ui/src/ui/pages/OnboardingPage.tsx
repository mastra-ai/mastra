import { useState } from 'react';
import { EmptyFactoryState } from '../domains/workspaces';
import { GitHubAppCallbackHandler } from '../domains/workspaces/components/GitHubAppCallbackHandler';
import type { GitHubAppCallbackResult } from '../domains/workspaces/components/GitHubAppCallbackHandler';

export const OnboardingPage = () => {
  const [githubCallback, setGithubCallback] = useState<GitHubAppCallbackResult>();
  return (
    <>
      <GitHubAppCallbackHandler onResult={setGithubCallback} />
      <EmptyFactoryState githubCallback={githubCallback} onDismissGithubCallback={() => setGithubCallback(undefined)} />
    </>
  );
};
