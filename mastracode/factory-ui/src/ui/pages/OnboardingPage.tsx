import { EmptyFactoryState } from '../domains/workspaces';
import { GitHubAppCallbackHandler } from '../domains/workspaces/components/GitHubAppCallbackHandler';

export const OnboardingPage = () => {
  return (
    <>
      <GitHubAppCallbackHandler />
      <EmptyFactoryState />
    </>
  );
};
