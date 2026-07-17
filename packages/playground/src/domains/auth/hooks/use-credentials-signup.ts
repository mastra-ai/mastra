import type { MastraClient } from '@mastra/client-js';
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
 * import { useCredentialsSignUp } from '@/domains/auth/hooks/use-credentials-signup';
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
/**
 * Makes a credentials sign-up request.
 * Exported for testing purposes.
 *
 * @internal
 */
export async function makeCredentialsSignUpRequest(
  client: MastraClient,
  { email, password, name }: CredentialsSignUpRequest,
): Promise<CredentialsSignUpResponse> {
  const { baseUrl = '', apiPrefix, headers: clientHeaders = {} } = client.options || {};
  const raw = (apiPrefix ?? '/api').trim();
  const normalized = raw === '' ? '' : raw.startsWith('/') ? raw : `/${raw}`;
  const prefix = normalized.replace(/\/+$/, '');

  // Generic Mastra auth endpoint - works with any credentials provider
  const response = await fetch(`${baseUrl}${prefix}/auth/credentials/sign-up`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...clientHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, name }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Failed to create account');
  }

  return data;
}

export function useCredentialsSignUp() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<CredentialsSignUpResponse, Error, CredentialsSignUpRequest>({
    mutationFn: ({ email, password, name }) => makeCredentialsSignUpRequest(client, { email, password, name }),
    onSuccess: () => {
      // Invalidate auth queries to refetch user state
      void queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}
