import { isGitLabRepository } from './github';
import type { GithubStatusReason, SourceControlRepository } from './github';

export type SourceControlHost = 'github' | 'gitlab';

/**
 * Why a host can't be connected: `unavailable` means its status couldn't be read, so Retry may help;
 * `auth_required` means the Factory session expired, so only signing in again helps.
 */
export type HostUnavailableReason = 'missing_config' | 'organization_required' | 'unavailable' | 'auth_required';

/** The reasons Connect can't fix but the user still can: Retry a failed status, or sign in again. */
export type RecoverableHostReason = Extract<HostUnavailableReason, 'unavailable' | 'auth_required'>;

export const HOST_NAMES = { github: 'GitHub', gitlab: 'GitLab' } as const;

export function hostUnavailableDescription(host: SourceControlHost, reason: HostUnavailableReason): string {
  if (reason === 'organization_required') return `Join an organization to connect ${HOST_NAMES[host]}.`;
  if (reason === 'unavailable') return `Couldn't load ${HOST_NAMES[host]} status.`;
  if (reason === 'auth_required') return `Your session expired. Sign in again to connect ${HOST_NAMES[host]}.`;
  return 'Unavailable for this deployment.';
}

export function isRecoverableHostReason(reason?: HostUnavailableReason): reason is RecoverableHostReason {
  return reason === 'unavailable' || reason === 'auth_required';
}

export function gitLabUnavailableReason(status?: {
  enabled: boolean;
  reason?: string;
}): HostUnavailableReason | undefined {
  if (status?.reason === 'unavailable') return 'unavailable';
  // An enabled GitLab with `auth_required` needs its own reauthorization, which Connect GitLab does.
  if (!status?.enabled && status?.reason === 'auth_required') return 'auth_required';
  if (!status?.enabled) return 'missing_config';
  if (status.reason === 'organization_required') return 'organization_required';
  return undefined;
}

export function githubUnavailableReason(reason?: GithubStatusReason): HostUnavailableReason | undefined {
  if (
    reason === 'unavailable' ||
    reason === 'organization_required' ||
    reason === 'missing_config' ||
    reason === 'auth_required'
  )
    return reason;
  return undefined;
}

export function repositoryHost(repository: SourceControlRepository): SourceControlHost {
  return isGitLabRepository(repository) ? 'gitlab' : 'github';
}
