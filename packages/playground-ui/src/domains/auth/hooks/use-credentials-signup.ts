import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import type { SignUpCredentials, AuthResult } from './use-auth-actions.js';
import { createAuthClient } from '../lib/auth-client';

/**
 * Hook for credentials-based signup flow.
 *
 * Provides state management and mutation for email/password signup forms.
 * Handles form submission, validation, loading state, and error messages.
 *
 * @example
 * ```tsx
 * function SignUpForm() {
 *   const { credentials, setCredentials, signUp, isLoading, error } = useCredentialsSignup();
 *
 *   return (
 *     <form onSubmit={async (e) => {
 *       e.preventDefault();
 *       await signUp();
 *     }}>
 *       <input
 *         type="text"
 *         placeholder="Name"
 *         value={credentials.name || ''}
 *         onChange={(e) => setCredentials({ ...credentials, name: e.target.value })}
 *       />
 *       <input
 *         type="email"
 *         placeholder="Email"
 *         value={credentials.email}
 *         onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
 *       />
 *       <input
 *         type="password"
 *         placeholder="Password"
 *         value={credentials.password}
 *         onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
 *       />
 *       {error && <div>{error}</div>}
 *       <button type="submit" disabled={isLoading}>
 *         {isLoading ? 'Creating account...' : 'Sign Up'}
 *       </button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useCredentialsSignup() {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = useState<SignUpCredentials>({
    email: '',
    password: '',
    name: '',
  });

  const authClient = useMemo(() => {
    const baseUrl = (client as any).options?.baseUrl || '';
    return createAuthClient(baseUrl);
  }, [client]);

  const mutation = useMutation<AuthResult, Error, void>({
    mutationFn: () => authClient.signUp(credentials),
    onSuccess: () => {
      // Invalidate auth queries to refetch user state
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  /**
   * Submit signup form with current credentials.
   */
  const signUp = async () => {
    return mutation.mutateAsync();
  };

  return {
    /** Current credentials state */
    credentials,
    /** Update credentials */
    setCredentials,
    /** Submit signup form */
    signUp,
    /** Whether signup is in progress */
    isLoading: mutation.isPending,
    /** Error message if signup failed */
    error: mutation.error?.message,
    /** Reset error state */
    reset: mutation.reset,
  };
}
