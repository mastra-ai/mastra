import { toast } from '@mastra/playground-ui/components/Toaster';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';
import { useSearchParams } from 'react-router';

import { queryKeys } from '../../../../api/keys';

const handledCallbackKeys = new Set<string>();
const callbackParamNames = [
  'github_app_installed',
  'github_app_requested',
  'github_app_user_authorized',
  'github_app_error',
  'installation_id',
  'setup_action',
];

// Codes Mastra Platform's GitHub App callback redirects back with when it
// refuses to link an installation or a GitHub account.
const callbackErrorMessages: Record<string, string> = {
  // Platform links an install made before the link only from its own Accounts page, in the user's session.
  github_app_installation_preexisting:
    'This GitHub account already had the Mastra GitHub App, so this link didn’t connect it. In Mastra Platform, open your organization settings and choose Refresh accounts under Accounts, then refresh here.',
  github_app_installation_not_owned:
    'Only the owner of this GitHub account, or an owner of the GitHub organization, can link this installation. Ask them to connect GitHub, or choose an account you own.',
  github_app_installation_linked_elsewhere:
    'This GitHub installation is already linked to another Mastra organization. Remove it there first, or install the app on a GitHub organization for this one.',
  github_app_sign_in_required: 'Sign in to Mastra Platform in this browser, then connect GitHub again.',
  github_app_session_mismatch:
    'This GitHub link was started for a different Mastra account or organization. Connect GitHub again from your own account.',
  github_app_person_not_platform_user:
    'This GitHub link was started for an account that isn’t a Mastra account. To link GitHub through Mastra Platform, sign in to Factory with Mastra.',
  github_app_link_already_used:
    'This GitHub link was already used. If you just finished connecting GitHub, you’re all set; otherwise connect GitHub again.',
  github_app_link_not_started_here:
    'This GitHub link was opened in a different browser, or opened directly instead of from Factory. Go back to Factory and choose Connect GitHub to start it again.',
  github_app_connection_mismatch:
    'Your Mastra account is already connected to a different GitHub account. Disconnect it in Mastra Platform, then connect GitHub again.',
  github_app_user_authorization_required:
    'Mastra Platform needs you to authorize the GitHub App with your GitHub account to link this installation. Connect GitHub again and approve the authorization step.',
  github_app_user_authorization_failed: 'GitHub authorization failed. Connect GitHub again.',
};

function callbackErrorMessage(code: string | null): string | undefined {
  return code && Object.hasOwn(callbackErrorMessages, code) ? callbackErrorMessages[code] : undefined;
}

export type GitHubAppCallbackResult =
  | { kind: 'requested' }
  | { kind: 'installed' }
  | { kind: 'user_authorized' }
  | { kind: 'error'; code?: string; message: string };

const GITHUB_CONNECTION_FAILED = 'GitHub connection failed';

/** The result a GitHub App callback URL reports; undefined when the URL carries none. */
export function callbackResult(searchParams: URLSearchParams): GitHubAppCallbackResult | undefined {
  if (searchParams.get('github_app_requested') === 'true') return { kind: 'requested' };
  if (searchParams.get('github_app_installed') === 'true') return { kind: 'installed' };
  if (searchParams.get('github_app_user_authorized') === 'true') return { kind: 'user_authorized' };
  const code = searchParams.get('github_app_error');
  if (code !== null) return { kind: 'error', code, message: callbackErrorMessage(code) ?? GITHUB_CONNECTION_FAILED };
  return undefined;
}

function toastCallbackResult(result: GitHubAppCallbackResult): void {
  switch (result.kind) {
    case 'requested':
      toast.success(
        'GitHub App installation requested. An organization owner needs to approve it before repositories appear here.',
      );
      return;
    case 'installed':
      toast.success('GitHub App installed');
      return;
    case 'user_authorized':
      toast.success('GitHub account connected');
      return;
    case 'error':
      if (result.message === GITHUB_CONNECTION_FAILED) {
        toast.error(result.message);
        return;
      }
      // Mapped messages explain what to do next, so keep them up until dismissed.
      toast.error(result.message, { duration: Infinity });
  }
}

function hasGitHubAppCallback(searchParams: URLSearchParams): boolean {
  return callbackParamNames.some(name => searchParams.has(name));
}

/**
 * Refreshes GitHub data and strips the callback params. With `inline`, the page reads the result itself
 * (`callbackResult`) and shows it in place, so nothing toasts; otherwise every result is a toast.
 */
export function GitHubAppCallbackHandler({ inline = false }: { inline?: boolean } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const reportResult = useEffectEvent((result: GitHubAppCallbackResult) => {
    if (inline) return;
    // The route tree mounts before the app-level Toaster sibling in main.tsx.
    // Defer one microtask so the toaster's own passive effects subscribe before
    // this callback emits a notification on initial page load.
    queueMicrotask(() => toastCallbackResult(result));
  });

  useEffect(() => {
    if (!hasGitHubAppCallback(searchParams)) return;

    const callbackKey = searchParams.toString();
    if (handledCallbackKeys.has(callbackKey)) return;
    handledCallbackKeys.add(callbackKey);

    const result = callbackResult(searchParams);

    void queryClient.invalidateQueries({ queryKey: queryKeys.githubStatus() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });

    if (result) reportResult(result);

    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        for (const name of callbackParamNames) {
          next.delete(name);
        }
        return next;
      },
      { replace: true },
    );
  }, [queryClient, searchParams, setSearchParams]);

  return null;
}
