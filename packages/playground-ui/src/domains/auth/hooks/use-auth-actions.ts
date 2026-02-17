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
 * import { useSSOLogin } from '@mastra/playground-ui';
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
export function useSSOLogin() {
  const client = useMastraClient();

  return useMutation<SSOLoginResponse, Error, { redirectUri?: string }>({
    mutationFn: async ({ redirectUri }) => {
      const params = new URLSearchParams();
      if (redirectUri) {
        params.set('redirect_uri', redirectUri);
      }

      const url = `${(client as any).options?.baseUrl || ''}/api/auth/sso/login${params.toString() ? `?${params}` : ''}`;

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
    },
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
 * import { useLogout } from '@mastra/playground-ui';
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
export function useLogout() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<LogoutResponse, Error, void>({
    mutationFn: async () => {
      const response = await fetch(`${(client as any).options?.baseUrl || ''}/api/auth/logout`, {
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
    },
    onSuccess: () => {
      // Invalidate all auth-related queries
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}
