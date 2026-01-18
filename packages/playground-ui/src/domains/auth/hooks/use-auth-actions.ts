import { useMutation, useQueryClient } from '@tanstack/react-query';

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
 * Result from logout operation
 */
export interface LogoutResult {
  success: boolean;
  redirectTo?: string;
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

  /**
   * Sign out and optionally redirect to SSO logout URL
   */
  const signOut = useMutation<LogoutResult, Error>({
    mutationFn: async () => {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include', // Include cookies for session
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `Sign out failed: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: data => {
      // Invalidate all queries to clear user state
      queryClient.invalidateQueries({ queryKey: ['auth'] });

      // Redirect to SSO logout URL if provided
      if (data.redirectTo) {
        window.location.href = data.redirectTo;
      }
    },
  });

  return {
    signIn,
    signUp,
    signOut,
  };
}
