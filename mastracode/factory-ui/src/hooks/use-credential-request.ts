import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';

export type CredentialRequestResponse = {
  request: {
    id: string;
    name: string;
    purpose: string;
    sessionId: string;
    factoryProjectId: string | null;
    status: 'pending' | 'fulfilled' | 'expired';
    expiresAt: string;
  };
  session: { id: string; title: string | null } | null;
  defaultTtlMs: number;
  maxTtlMs: number;
};

export type SubmitCredentialBody = { value: string; ttlMs: number; allowSandbox: boolean };

const credentialRequestKey = (requestId: string) => ['credential-request', requestId] as const;

export function useCredentialRequest(requestId: string) {
  const { client } = useApiConfig();
  return useQuery({
    queryKey: credentialRequestKey(requestId),
    queryFn: () => client.get<CredentialRequestResponse>(`/web/credential-requests/${encodeURIComponent(requestId)}`),
    retry: false,
  });
}

/** The value only travels in this POST body; nothing about it is cached or returned. */
export function useSubmitCredential(requestId: string) {
  const { client } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitCredentialBody) =>
      client.post<{ credential: { name: string; expiresAt: string } }>(
        `/web/credential-requests/${encodeURIComponent(requestId)}`,
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: credentialRequestKey(requestId) });
    },
  });
}
