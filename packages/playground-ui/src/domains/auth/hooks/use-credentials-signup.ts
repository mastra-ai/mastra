import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export type CredentialsSignUpRequest = {
  email: string;
  password: string;
  name?: string;
};

export type CredentialsSignUpResponse = {
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  error?: string;
};

/**
 * Hook to sign up with email/password credentials.
 *
 * Uses Better Auth's email sign-up endpoint.
 *
 * @example
 * ```tsx
 * import { useCredentialsSignUp } from '@mastra/playground-ui';
 *
 * function SignUpForm() {
 *   const { mutate: signUp, isPending, error } = useCredentialsSignUp();
 *
 *   const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
 *     e.preventDefault();
 *     const formData = new FormData(e.currentTarget);
 *     signUp({
 *       email: formData.get('email') as string,
 *       password: formData.get('password') as string,
 *       name: formData.get('name') as string,
 *     }, {
 *       onSuccess: () => {
 *         window.location.href = '/';
 *       },
 *     });
 *   };
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input name="name" type="text" />
 *       <input name="email" type="email" required />
 *       <input name="password" type="password" required />
 *       <button type="submit" disabled={isPending}>
 *         Sign up
 *       </button>
 *       {error && <p>{error.message}</p>}
 *     </form>
 *   );
 * }
 * ```
 */
export function useCredentialsSignUp() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<CredentialsSignUpResponse, Error, CredentialsSignUpRequest>({
    mutationFn: async ({ email, password, name }) => {
      const baseUrl = (client as any).options?.baseUrl || '';

      // Generic Mastra auth endpoint - works with any credentials provider
      const response = await fetch(`${baseUrl}/api/auth/credentials/sign-up`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to create account');
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate auth queries to refetch user state
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}
