import type { RequestContext } from '@mastra/core/request-context';

import type { GithubPatKind } from './pat.js';

const GITHUB_TOKEN_INJECTOR_CONTEXT_KEY = 'factoryGithubTokenInjector';
const GITHUB_PAT_KIND_CONTEXT_KEY = 'factoryGithubPatKind';

type GithubTokenInjector = (token: string) => void;

export function registerGithubTokenInjector(requestContext: RequestContext, injector: GithubTokenInjector): void {
  requestContext.set(GITHUB_TOKEN_INJECTOR_CONTEXT_KEY, injector);
}

/** Record which PAT kind the active sandbox was provisioned with, so token
 * refresh re-injects the same credential (review-board sandboxes keep the
 * reviewer token instead of being clobbered with the worker token). */
export function registerGithubPatKind(requestContext: RequestContext, kind: GithubPatKind): void {
  requestContext.set(GITHUB_PAT_KIND_CONTEXT_KEY, kind);
}

export function getRegisteredGithubPatKind(requestContext: RequestContext): GithubPatKind {
  const kind = requestContext.get(GITHUB_PAT_KIND_CONTEXT_KEY);
  return kind === 'reviewer' ? 'reviewer' : 'default';
}

export function injectGithubToken(requestContext: RequestContext, token: string): void {
  const injector = requestContext.get(GITHUB_TOKEN_INJECTOR_CONTEXT_KEY) as GithubTokenInjector | undefined;
  if (!injector) {
    throw new Error('GitHub token refresh requires an active Factory sandbox workspace.');
  }
  injector(token);
}
