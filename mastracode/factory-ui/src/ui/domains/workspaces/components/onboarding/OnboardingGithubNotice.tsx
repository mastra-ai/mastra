import { Notice } from '@mastra/playground-ui/components/Notice';

import { MASTRA_PLATFORM_URL } from '../../../factory/services/platformConnect';
import type { GitHubAppCallbackResult } from '../GitHubAppCallbackHandler';

/** Where Platform's Refresh accounts lives; the Accounts section there shows only to organization admins. */
const PLATFORM_ACCOUNTS_URL = `${MASTRA_PLATFORM_URL}/settings/general`;

interface Recovery {
  /** A Mastra Platform page where the refusal is fixed first. */
  platformHref?: string;
  /** What picks the fix up here: a status refresh, or a new GitHub connect. */
  next: 'refresh' | 'connect';
}

function recoveryFor(code?: string): Recovery {
  // Refresh accounts links the older install in Platform; a refresh here then sees it.
  if (code === 'github_app_installation_preexisting') return { platformHref: PLATFORM_ACCOUNTS_URL, next: 'refresh' };
  // Disconnecting the other GitHub account in Platform links nothing; only a new connect does.
  if (code === 'github_app_connection_mismatch') return { platformHref: MASTRA_PLATFORM_URL, next: 'connect' };
  // An already-used link usually means the install went through.
  if (code === 'github_app_link_already_used') return { next: 'refresh' };
  return { next: 'connect' };
}

export interface OnboardingGithubNoticeProps {
  callback?: GitHubAppCallbackResult;
  /** GitHub status has settled with a usable installation. */
  connected: boolean;
  /** GitHub status has settled since the callback, so `connected` reflects the install it reported. */
  statusSettled: boolean;
  refreshing: boolean;
  onConnect: () => void;
  onRefresh: () => void;
  onDismiss: () => void;
}

/** What the last GitHub App round trip did, with the step that gets the user unstuck. */
export function OnboardingGithubNotice({
  callback,
  connected,
  statusSettled,
  refreshing,
  onConnect,
  onRefresh,
  onDismiss,
}: OnboardingGithubNoticeProps) {
  const refresh = (
    <Notice.Button disabled={refreshing} onClick={onRefresh}>
      Refresh
    </Notice.Button>
  );
  const connectAgain = <Notice.Button onClick={onConnect}>Connect GitHub again</Notice.Button>;

  if (callback?.kind === 'error') {
    const recovery = recoveryFor(callback.code);
    const informational = !recovery.platformHref && recovery.next === 'refresh';
    return (
      <Notice
        variant={informational ? 'info' : 'destructive'}
        role={informational ? undefined : 'alert'}
        onDismiss={onDismiss}
        action={
          <>
            {recovery.platformHref && (
              <Notice.Button render={<a href={recovery.platformHref} target="_blank" rel="noopener noreferrer" />}>
                Open Mastra Platform
              </Notice.Button>
            )}
            {recovery.next === 'refresh' ? refresh : connectAgain}
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
      <Notice variant="warning" title="GitHub App installation requested" onDismiss={onDismiss} action={refresh}>
        An organization owner needs to approve it before repositories appear here.
      </Notice>
    );
  }
  // Platform hides a personal-account install from organizations with more than one member, so the install
  // succeeds on GitHub and Factory still sees nothing. Say why instead of offering the same Connect again.
  if (callback?.kind === 'installed' && statusSettled && !connected) {
    return (
      <Notice
        variant="warning"
        role="alert"
        title="Factory can’t use this GitHub installation"
        onDismiss={onDismiss}
        action={
          <>
            <Notice.Button onClick={onConnect}>Choose another account</Notice.Button>
            {refresh}
          </>
        }
      >
        A personal GitHub account only works while your Mastra organization has one member, who connected it. With
        teammates, install the app on a GitHub organization instead.
      </Notice>
    );
  }
  return null;
}
