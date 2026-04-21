import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { SSOLoginResponse, LogoutResponse } from '../types';

/**
 * Hook to initiate SSO login.
 *
 * Returns mutation to get the SSO login URL and redirect.
 *
 * @example
 * ```tsx
 * import { useSSOLogin } from '@/domains/auth/hooks/use-auth-actions';
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
/**
 * Makes a request to initiate SSO login.
 * Exported for testing purposes.
 *
 * @internal
 */
export async function makeSSOLoginRequest(
  client: { options: any },
  { redirectUri }: { redirectUri?: string },
): Promise<SSOLoginResponse> {
  const { baseUrl = '', apiPrefix } = client.options || {};
  const raw = (apiPrefix || '/api').trim();
  const prefix = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/$/, '');

  const params = new URLSearchParams();
  if (redirectUri) {
    params.set('redirect_uri', redirectUri);
  }

  const url = `${baseUrl}${prefix}/auth/sso/login${params.toString() ? `?${params}` : ''}`;

  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to initiate SSO login: ${response.status}`);
  }

  return response.json();
}

export function useSSOLogin() {
  const client = useMastraClient();

  return useMutation<SSOLoginResponse, Error, { redirectUri?: string }>({
    mutationFn: ({ redirectUri }) => makeSSOLoginRequest(client as any, { redirectUri }),
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
 * import { useLogout } from '@/domains/auth/hooks/use-auth-actions';
 *
 * function LogoutButton() {
 *   const { mutate: logout, isPending } = useLogout();
 *   const queryClient = useQueryClient();
 *
 *   const handleLogout = () => {
 *     logout(undefined, {
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
export async function makeLogoutRequest(client: { options: any }): Promise<LogoutResponse> {
  const { baseUrl = '', apiPrefix } = client.options || {};
  const raw = (apiPrefix || '/api').trim();
  const prefix = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}${prefix}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to logout: ${response.status}`);
  }

  return response.json();
}

export function useLogout() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<LogoutResponse, Error, void>({
    mutationFn: () => makeLogoutRequest(client as any),
    onSuccess: () => {
      // Invalidate all auth-related queries
      void queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}
