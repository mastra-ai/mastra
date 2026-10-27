import { toast } from '@mastra/playground-ui/components/Toaster';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { fetchGithubStatus, unavailableInstallMessage } from '../services/github';

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
  github_app_installation_preexisting:
    'Your GitHub account already had the Mastra GitHub App installed before you clicked Connect GitHub, so this link didn’t connect it. Uninstall the Mastra GitHub App from that GitHub account or organization, then choose Connect GitHub again.',
  github_app_installation_not_owned:
    'Only the owner of this GitHub account, or an owner of the GitHub organization, can link this installation.',
  github_app_installation_linked_elsewhere:
    'This GitHub installation is already linked to another Mastra organization. Remove it there first, or install the app again for this organization.',
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
    'Your Mastra account is already connected to a different GitHub account. Disconnect that GitHub account in Mastra Platform first, then connect GitHub here again.',
  github_app_user_authorization_required:
    'Mastra Platform needs you to authorize the GitHub App with your GitHub account to link this installation. Connect GitHub again and approve the authorization step.',
  github_app_user_authorization_failed: 'GitHub authorization failed. Connect GitHub again.',
};

function callbackErrorMessage(code: string | null): string | undefined {
  return code && Object.hasOwn(callbackErrorMessages, code) ? callbackErrorMessages[code] : undefined;
}

function hasGitHubAppCallback(searchParams: URLSearchParams): boolean {
  return callbackParamNames.some(name => searchParams.has(name));
}

export function GitHubAppCallbackHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { baseUrl } = useApiConfig();

  useEffect(() => {
    if (!hasGitHubAppCallback(searchParams)) return;

    const callbackKey = searchParams.toString();
    if (handledCallbackKeys.has(callbackKey)) return;
    handledCallbackKeys.add(callbackKey);

    const requested = searchParams.get('github_app_requested') === 'true';
    const installed = searchParams.get('github_app_installed') === 'true';
    const userAuthorized = searchParams.get('github_app_user_authorized') === 'true';
    const failed = searchParams.has('github_app_error');
    const errorMessage = callbackErrorMessage(searchParams.get('github_app_error'));

    void queryClient.invalidateQueries({ queryKey: queryKeys.githubStatus() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });

    // The route tree mounts before the app-level Toaster sibling in main.tsx.
    // Defer one microtask so the toaster's own passive effects subscribe before
    // this callback emits a notification on initial page load.
    queueMicrotask(() => {
      if (requested) {
        toast.success(
          'GitHub App installation requested. An organization owner needs to approve it before repositories appear here.',
        );
      } else if (installed) {
        void queryClient
          .fetchQuery({ queryKey: queryKeys.githubStatus(), queryFn: () => fetchGithubStatus(baseUrl) })
          .then(status => {
            const unavailableInstall = status.connected ? undefined : unavailableInstallMessage(status);
            if (unavailableInstall) toast.warning(unavailableInstall, { duration: Infinity });
            else toast.success('GitHub App installed');
          });
      } else if (userAuthorized) {
        toast.success('GitHub account connected');
      } else if (errorMessage) {
        // These explain what to do next, so keep them up until dismissed.
        toast.error(errorMessage, { duration: Infinity });
      } else if (failed) {
        toast.error('GitHub connection failed');
      }
    });

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
  }, [baseUrl, queryClient, searchParams, setSearchParams]);

  return null;
}
