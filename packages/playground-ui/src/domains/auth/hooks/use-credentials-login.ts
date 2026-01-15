import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export type CredentialsLoginRequest = {
  email: string;
  password: string;
};

export type CredentialsLoginResponse = {
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  error?: string;
};

/**
 * Hook to login with email/password credentials.
 *
 * Uses Better Auth's email sign-in endpoint.
 *
 * @example
 * ```tsx
 * import { useCredentialsLogin } from '@mastra/playground-ui';
 *
 * function LoginForm() {
 *   const { mutate: login, isPending, error } = useCredentialsLogin();
 *
 *   const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
 *     e.preventDefault();
 *     const formData = new FormData(e.currentTarget);
 *     login({
 *       email: formData.get('email') as string,
 *       password: formData.get('password') as string,
 *     }, {
 *       onSuccess: () => {
 *         window.location.href = '/';
 *       },
 *     });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input name="email" type="email" required />
 *       <input name="password" type="password" required />
 *       <button type="submit" disabled={isPending}>
 *         Sign in
 *       </button>
 *       {error && <p>{error.message}</p>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useCredentialsLogin() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<CredentialsLoginResponse, Error, CredentialsLoginRequest>({
    mutationFn: async ({ email, password }) => {
      const baseUrl = (client as any).options?.baseUrl || '';

      // Generic Mastra auth endpoint - works with any credentials provider
      const response = await fetch(`${baseUrl}/api/auth/credentials/sign-in`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Invalid email or password');
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate auth queries to refetch user state
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}
