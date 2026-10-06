import type { MastraClient } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions } from '../shared/query-options';

import { makeSSOLoginRequest } from './sso-login';
import type { LogoutResponse } from './types';

/**
 * Hook to initiate SSO login.
 *
 * Returns mutation to get the SSO login URL and redirect.
 *
 * @example
 * ```tsx
 * import { useSSOLogin } from '@mastra/react/hooks/auth';
 *
 * function SSOLoginButton() {
 *   const { mutate: login, isPending } = useSSOLogin();
 *
 *   const handleClick = () => {
 *     login({ redirectUri: window.location.href }, {
 *       onSuccess: (data) => {
 *         window.location.href = data.url;
 *       },
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleClick} disabled={isPending}>
 *       Sign in with SSO
 *     </button>
 *   );
 * }
 * ```
 */
type SSOLoginResponse = Awaited<ReturnType<typeof makeSSOLoginRequest>>;

export function useSSOLogin({
  queryOptions,
}: { queryOptions?: MastraMutationOptions<SSOLoginResponse, { redirectUri?: string }> } = {}) {
  const client = useMastraClient();

  return useMutation({
    mutationFn: ({ redirectUri }: { redirectUri?: string }) => makeSSOLoginRequest(client, { redirectUri }),
    ...queryOptions,
  });
}

/**
 * Hook to logout the current user.
 *
 * Destroys the current session and optionally redirects to
 * the SSO logout URL if available.
 *
 * @example
 * ```tsx
 * import { useLogout } from '@mastra/react/hooks/auth';
 *
 * function LogoutButton({ userId }: { userId: string }) {
 *   const { mutate: logout, isPending } = useLogout();
 *   const queryClient = useQueryClient();
 *
 *   const handleLogout = () => {
 *     logout({ userId }, {
 *       onSuccess: (data) => {
 *         queryClient.invalidateQueries({ queryKey: ['auth'] });
 *         if (data.redirectTo) {
 *           window.location.href = data.redirectTo;
 *         } else {
 *           window.location.reload();
 *         }
 *       },
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleLogout} disabled={isPending}>
 *       Sign out
 *     </button>
 *   );
 * }
 * ```
 */
/**
 * Makes a logout request.
 * Exported for testing purposes.
 *
 * @internal
 */
export async function makeLogoutRequest(client: Pick<MastraClient, 'options'>): Promise<LogoutResponse> {
  const { baseUrl = '', apiPrefix, headers: clientHeaders = {} } = client.options;
  const raw = (apiPrefix || '/api').trim();
  const prefix = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}${prefix}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...clientHeaders,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to logout: ${response.status}`);
  }

  return response.json();
}

export interface UseLogoutOptions {
  /**
   * Runs once the server has ended the session, before the mutation resolves.
   * Failures are ignored so cleanup never turns a completed sign-out into an error.
   */
  onLoggedOut?: (variables: { userId: string }) => Promise<void>;
  queryOptions?: MastraMutationOptions<LogoutResponse, { userId: string }>;
}

export function useLogout({ onLoggedOut, queryOptions }: UseLogoutOptions = {}) {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<LogoutResponse, Error, { userId: string }>({
    mutationFn: async variables => {
      const response = await makeLogoutRequest(client);
      await onLoggedOut?.(variables).catch(() => {});
      return response;
    },
    onSuccess: () => {
      // Invalidate all auth-related queries
      void queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    ...queryOptions,
  });
}
