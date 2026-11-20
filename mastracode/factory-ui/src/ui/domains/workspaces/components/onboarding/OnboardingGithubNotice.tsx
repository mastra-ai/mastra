import { Notice } from '@mastra/playground-ui/components/Notice';

import { useApiConfig } from '../../../../../api/config';
import { useFactoryAuth } from '../../../../../hooks/useFactoryAuth';
import { MASTRA_PLATFORM_URL } from '../../../factory/services/platformConnect';
import type { GithubStatusReason } from '../../services/github';
import { githubCallbackRecovery } from '../../services/githubCallbackRecovery';
import type { GithubCallbackRecovery } from '../../services/githubCallbackRecovery';
import { signOutOfOnboarding } from '../../services/onboardingSignOut';
import type { GitHubAppCallbackResult } from '../GitHubAppCallbackHandler';

/**
 * Where Platform's Refresh accounts lives (shown to organization admins). The Factory organization id is the
 * Platform one the GitHub connect flow sent, so it fills Platform's `/orgs/:orgId` route; without it, Platform's home.
 */
function platformAccountsUrl(organizationId?: string): string {
  return organizationId
    ? `${MASTRA_PLATFORM_URL}/orgs/${encodeURIComponent(organizationId)}/settings/general`
    : MASTRA_PLATFORM_URL;
}

export interface OnboardingGithubNoticeProps {
  callback?: GitHubAppCallbackResult;
  /** The latest GitHub status reason, kept while a refresh runs. */
  statusReason?: GithubStatusReason;
  /** Status has been read since this page loaded, so it reflects the install the callback reported. */
  statusChecked: boolean;
  /** Connect is on its way to GitHub; a second click would start another round trip. */
  redirecting: boolean;
  refreshing: boolean;
  onConnect: () => void;
  onRefresh: () => void;
  onDismiss: () => void;
}

/** What the last GitHub App round trip did, or what Platform says about it, with the step that gets the user unstuck. */
export function OnboardingGithubNotice({
  callback,
  statusReason,
  statusChecked,
  redirecting,
  refreshing,
  onConnect,
  onRefresh,
  onDismiss,
}: OnboardingGithubNoticeProps) {
  const auth = useFactoryAuth();

  if (callback?.kind === 'error') {
    const recovery = githubCallbackRecovery(callback.code);
    const informational = recovery.platformPage === undefined && recovery.next === 'refresh';
    const platformHref =
      recovery.platformPage === 'accounts' ? platformAccountsUrl(auth.data?.user?.organizationId) : MASTRA_PLATFORM_URL;
    return (
      <Notice
        variant={informational ? 'info' : 'destructive'}
        role={informational ? undefined : 'alert'}
        onDismiss={onDismiss}
        action={
          <>
            {recovery.platformPage && (
              <Notice.Button render={<a href={platformHref} target="_blank" rel="noopener noreferrer" />}>
                Open Mastra Platform
              </Notice.Button>
            )}
            <CallbackNextAction
              next={recovery.next}
              redirecting={redirecting}
              refreshing={refreshing}
              onConnect={onConnect}
              onRefresh={onRefresh}
            />
          </>
        }
      >
        {callback.message}
      </Notice>
    );
  }
  // Kept up even when other repositories already list: the request is for another account, still pending.
  if (callback?.kind === 'requested') {
    return (
      <Notice
        variant="warning"
        title="GitHub App installation requested"
        onDismiss={onDismiss}
        action={<RefreshButton refreshing={refreshing} onRefresh={onRefresh} />}
      >
        An organization owner needs to approve it before repositories appear here.
      </Notice>
    );
  }
  // Platform hides a personal-account install from organizations with more than one member, so the install
  // succeeds on GitHub and Factory still sees nothing. That holds until the organization changes, so it can't be
  // dismissed, and it shows on every visit.
  if (statusReason === 'personal_install_hidden') {
    return (
      <Notice
        variant="warning"
        role="alert"
        title="Factory can’t use this GitHub installation"
        action={
          <>
            <Notice.Button disabled={redirecting} onClick={onConnect}>
              Choose another account
            </Notice.Button>
            <RefreshButton refreshing={refreshing} onRefresh={onRefresh} />
          </>
        }
      >
        A personal GitHub account only works while your Mastra organization has one member, who connected it. Pending
        invitations count as members. With teammates, install the app on a GitHub organization instead.
      </Notice>
    );
  }
  // GitHub reported an install, yet status (read since) has no usable one and no reason for it, e.g. a suspended
  // installation. Without a known cause, say what was seen and offer both ways forward.
  if (callback?.kind === 'installed' && statusChecked && statusReason === 'not_connected') {
    return (
      <Notice
        variant="warning"
        role="alert"
        title="Factory can’t see this GitHub installation yet"
        onDismiss={onDismiss}
        action={
          <>
            <Notice.Button disabled={redirecting} onClick={onConnect}>
              Choose another account
            </Notice.Button>
            <RefreshButton refreshing={refreshing} onRefresh={onRefresh} />
          </>
        }
      >
        GitHub reported the install, but Mastra Platform hasn’t shared a usable installation with this organization.
        Refresh in a moment, or install the app on another account.
      </Notice>
    );
  }
  return null;
}

function RefreshButton({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  return (
    <Notice.Button disabled={refreshing} onClick={onRefresh}>
      Refresh
    </Notice.Button>
  );
}

function CallbackNextAction({
  next,
  redirecting,
  refreshing,
  onConnect,
  onRefresh,
}: {
  next: GithubCallbackRecovery['next'];
  redirecting: boolean;
  refreshing: boolean;
  onConnect: () => void;
  onRefresh: () => void;
}) {
  const { baseUrl } = useApiConfig();
  if (next === 'refresh') return <RefreshButton refreshing={refreshing} onRefresh={onRefresh} />;
  if (next === 'sign_out') {
    return <Notice.Button onClick={() => signOutOfOnboarding(baseUrl)}>Sign out</Notice.Button>;
  }
  return (
    <Notice.Button disabled={redirecting} onClick={onConnect}>
      Connect GitHub again
    </Notice.Button>
  );
}
