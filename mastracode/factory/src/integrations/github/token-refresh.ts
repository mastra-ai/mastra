import type { RequestContext } from '@mastra/core/request-context';

const GITHUB_TOKEN_INJECTOR_CONTEXT_KEY = 'factoryGithubTokenInjector';

type GithubTokenInjector = (token: string) => void;

export function registerGithubTokenInjector(requestContext: RequestContext, injector: GithubTokenInjector): void {
  requestContext.set(GITHUB_TOKEN_INJECTOR_CONTEXT_KEY, injector);
}

export function injectGithubToken(requestContext: RequestContext, token: string): void {
  const injector = requestContext.get(GITHUB_TOKEN_INJECTOR_CONTEXT_KEY) as GithubTokenInjector | undefined;
  if (!injector) {
    throw new Error('GitHub token refresh requires an active Factory sandbox workspace.');
  }
  injector(token);
}
