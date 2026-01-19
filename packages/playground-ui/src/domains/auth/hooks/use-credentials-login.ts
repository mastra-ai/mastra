import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import type { SignInCredentials, AuthResult } from './use-auth-actions.js';
import { createAuthClient } from '../lib/auth-client';

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
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = useState<SignInCredentials>({
    email: '',
    password: '',
  });

  const authClient = useMemo(() => {
    const baseUrl = (client as any).options?.baseUrl || '';
    return createAuthClient(baseUrl);
  }, [client]);

  const mutation = useMutation<AuthResult, Error, void>({
    mutationFn: () => authClient.signIn(credentials),
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
