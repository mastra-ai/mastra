import type { RequestContext } from '@mastra/core/request-context';

import type { GithubPatKind } from './pat.js';

const GITHUB_TOKEN_INJECTOR_CONTEXT_KEY = 'factoryGithubTokenInjector';
const GITHUB_PAT_KIND_CONTEXT_KEY = 'factoryGithubPatKind';
const GITHUB_REFRESH_TARGET_CONTEXT_KEY = 'factoryGithubRefreshTarget';

type GithubTokenInjector = (token: string) => void;

/** The authorized GitHub repository behind the request's Factory session. */
export interface GithubRefreshTarget {
  orgId: string;
  repositoryId: string;
}

/** Recorded by the workspace resolver once it has authorized a GitHub-backed
 * session, before the sandbox starts, so the refresh tool is offered only to
 * sessions it can serve. */
export function registerGithubRefreshTarget(requestContext: RequestContext, target: GithubRefreshTarget): void {
  requestContext.set(GITHUB_REFRESH_TARGET_CONTEXT_KEY, target);
}

export function getGithubRefreshTarget(requestContext: RequestContext): GithubRefreshTarget | undefined {
  return requestContext.get(GITHUB_REFRESH_TARGET_CONTEXT_KEY) as GithubRefreshTarget | undefined;
}

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

export function requireGithubTokenInjector(requestContext: RequestContext): GithubTokenInjector {
  const injector = requestContext.get(GITHUB_TOKEN_INJECTOR_CONTEXT_KEY) as GithubTokenInjector | undefined;
  if (!injector) {
    throw new Error('GitHub token refresh requires an active Factory sandbox workspace.');
  }
  return injector;
}
