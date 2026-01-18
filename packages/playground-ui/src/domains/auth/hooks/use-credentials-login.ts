import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { SignInCredentials, AuthResult } from './use-auth-actions.js';

/**
 * Hook for credentials-based login flow.
 *
 * Provides state management and mutation for email/password login forms.
 * Handles form submission, loading state, and error messages.
 *
 * @example
 * ```tsx
 * function LoginForm() {
 *   const { credentials, setCredentials, signIn, isLoading, error } = useCredentialsLogin();
 *
 *   return (
 *     <form onSubmit={async (e) => {
 *       e.preventDefault();
 *       await signIn();
 *     }}>
 *       <input
 *         type="email"
 *         value={credentials.email}
 *         onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
 *       />
 *       <input
 *         type="password"
 *         value={credentials.password}
 *         onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
 *       />
 *       {error && <div>{error}</div>}
 *       <button type="submit" disabled={isLoading}>
 *         {isLoading ? 'Signing in...' : 'Sign In'}
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useCredentialsLogin() {
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = useState<SignInCredentials>({
    email: '',
    password: '',
  });

  const mutation = useMutation<AuthResult, Error, void>({
    mutationFn: async () => {
      const response = await fetch('/api/auth/credentials/sign-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Sign in failed');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate auth queries to refetch user state
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  /**
   * Submit login form with current credentials.
   */
  const signIn = async () => {
    return mutation.mutateAsync();
  };

  return {
    /** Current credentials state */
    credentials,
    /** Update credentials */
    setCredentials,
    /** Submit login form */
    signIn,
    /** Whether login is in progress */
    isLoading: mutation.isPending,
    /** Error message if login failed */
    error: mutation.error?.message,
    /** Reset error state */
    reset: mutation.reset,
  };
}
