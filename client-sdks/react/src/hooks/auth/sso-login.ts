import type { MastraClient } from '@mastra/client-js';

export type SSOLoginResponse = {
  url: string;
};

export async function makeSSOLoginRequest(
  client: Pick<MastraClient, 'options'>,
  { redirectUri }: { redirectUri?: string },
): Promise<SSOLoginResponse> {
  const { baseUrl = '', apiPrefix, headers: clientHeaders = {} } = client.options;
  const raw = (apiPrefix || '/api').trim();
  const prefix = (raw.startsWith('/') ? raw : `/${raw}`).replace(/\/$/, '');

  const params = new URLSearchParams();
  if (redirectUri) {
    params.set('redirect_uri', redirectUri);
  }

  const url = `${baseUrl}${prefix}/auth/sso/login${params.toString() ? `?${params}` : ''}`;

  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      ...clientHeaders,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to initiate SSO login: ${response.status}`);
  }

  return response.json();
}
