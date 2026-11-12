import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';

import { MASTRA_PLATFORM_URL } from '../../../factory/services/platformConnect';
import type { GitHubAppCallbackResult } from '../GitHubAppCallbackHandler';

type Recovery = 'platform' | 'refresh' | 'connect';

/**
 * The step that clears a refusal: some are fixed in Mastra Platform, then picked up by a refresh here;
 * an already-used link means the install went through; the rest need a new connect.
 */
function recoveryFor(code?: string): Recovery {
  if (code === 'github_app_installation_preexisting' || code === 'github_app_connection_mismatch') return 'platform';
  if (code === 'github_app_link_already_used') return 'refresh';
  return 'connect';
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
    return (
      <Notice
        variant={recovery === 'refresh' ? 'info' : 'destructive'}
        role={recovery === 'refresh' ? undefined : 'alert'}
        onDismiss={onDismiss}
        action={<RecoveryActions recovery={recovery} refresh={refresh} connectAgain={connectAgain} />}
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

function RecoveryActions({
  recovery,
  refresh,
  connectAgain,
}: {
  recovery: Recovery;
  refresh: ReactNode;
  connectAgain: ReactNode;
}) {
  if (recovery === 'connect') return connectAgain;
  if (recovery === 'refresh') return refresh;
  return (
    <>
      <Notice.Button render={<a href={MASTRA_PLATFORM_URL} target="_blank" rel="noopener noreferrer" />}>
        Open Mastra Platform
      </Notice.Button>
      {refresh}
    </>
  );
}
