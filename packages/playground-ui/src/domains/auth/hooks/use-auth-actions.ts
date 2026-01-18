import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SSOLoginResponse, LogoutResponse } from '../types.js';

/**
 * Credentials for signing in with email and password
 */
export interface SignInCredentials {
  email: string;
  password: string;
}

/**
 * Credentials for signing up with email and password
 */
export interface SignUpCredentials {
  email: string;
  password: string;
  name?: string;
}

/**
 * Result from sign in or sign up operations
 */
export interface AuthResult {
  user: {
    id: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
  };
  token?: string;
}

/**
 * Hook providing authentication actions (sign in, sign up, sign out)
 *
 * @example
 * ```tsx
 * function LoginForm() {
 *   const { signIn, signOut } = useAuthActions();
 *
 *   const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
 *     e.preventDefault();
 *     const formData = new FormData(e.currentTarget);
 *     const email = formData.get('email') as string;
 *     const password = formData.get('password') as string;
 *
 *     await signIn.mutateAsync({ email, password });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input type="email" name="email" required />
 *       <input type="password" name="password" required />
 *       <button type="submit" disabled={signIn.isPending}>
 *         {signIn.isPending ? 'Signing in...' : 'Sign In'}
 *       </button>
 *       {signIn.error && <div>Error: {signIn.error.message}</div>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useAuthActions() {
  const queryClient = useQueryClient();

  /**
   * Sign in with email and password
   */
  const signIn = useMutation<AuthResult, Error, SignInCredentials>({
    mutationFn: async credentials => {
      const response = await fetch('/api/auth/credentials/sign-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `Sign in failed: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate auth queries to refetch user state
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  /**
   * Sign up with email and password
   */
  const signUp = useMutation<AuthResult, Error, SignUpCredentials>({
    mutationFn: async credentials => {
      const response = await fetch('/api/auth/credentials/sign-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `Sign up failed: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate auth queries to refetch user state
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  return {
    signIn,
    signUp,
  };
}

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
