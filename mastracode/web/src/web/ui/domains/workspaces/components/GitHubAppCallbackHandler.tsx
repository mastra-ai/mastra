import { toast } from '@mastra/playground-ui/components/Toaster';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

import { queryKeys } from '../../../../../shared/api/keys';

const handledCallbackKeys = new Set<string>();
const callbackParamNames = [
  'github_app_installed',
  'github_app_requested',
  'github_app_user_authorized',
  'github_app_error',
  'installation_id',
  'setup_action',
];

function hasGitHubAppCallback(searchParams: URLSearchParams): boolean {
  return callbackParamNames.some(name => searchParams.has(name));
}

export function GitHubAppCallbackHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!hasGitHubAppCallback(searchParams)) return;

    const callbackKey = searchParams.toString();
    if (handledCallbackKeys.has(callbackKey)) return;
    handledCallbackKeys.add(callbackKey);

    const requested = searchParams.get('github_app_requested') === 'true';
    const installed = searchParams.get('github_app_installed') === 'true';
    const userAuthorized = searchParams.get('github_app_user_authorized') === 'true';
    const failed = searchParams.has('github_app_error');

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
        toast.success('GitHub App installed');
      } else if (userAuthorized) {
        toast.success('GitHub account connected');
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
  }, [queryClient, searchParams, setSearchParams]);

  return null;
}
