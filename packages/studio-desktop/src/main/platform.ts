import type { PlatformOrganization, PlatformProject, PlatformUser } from '../shared/types';
import { DEFAULT_PLATFORM_BASE_URL } from './defaults';
import { normalizeServerUrl } from './url';

export interface PlatformTokens {
  accessToken: string;
  refreshToken: string;
  organizationId?: string;
  user?: PlatformUser;
}

export interface PlatformSession extends PlatformTokens {
  baseUrl: string;
}

export interface PlatformFetchResult {
  organizations: PlatformOrganization[];
  projects: PlatformProject[];
  organizationId?: string;
}

export function normalizePlatformBaseUrl(input?: string) {
  return normalizeServerUrl(input?.trim() || DEFAULT_PLATFORM_BASE_URL);
}

export function buildPlatformCliLoginUrl(baseUrl: string, callbackPort: number, state: string) {
  const url = new URL('/v1/auth/login', normalizePlatformBaseUrl(baseUrl));
  url.searchParams.set('product', 'cli');
  url.searchParams.set('cli_port', String(callbackPort));
  url.searchParams.set('state', state);
  return url.toString();
}

export function buildHostedStudioLoginUrl(baseUrl: string, instanceUrl: string) {
  const origin = normalizeServerUrl(instanceUrl);
  const url = new URL('/v1/auth/login', normalizePlatformBaseUrl(baseUrl));
  url.searchParams.set('product', 'deploy');
  url.searchParams.set('redirect_uri', `${origin}/api/auth/sso/callback`);
  url.searchParams.set('post_login_redirect', '/');
  return url.toString();
}

export function hostedStudioOrigin(instanceUrl: string) {
  return new URL(normalizeServerUrl(instanceUrl)).origin;
}

export function hostedStudioExternalNavigationUrl(requestUrl: string, instanceUrl: string) {
  try {
    const url = new URL(requestUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return requestUrl;

    return url.origin === hostedStudioOrigin(instanceUrl) ? undefined : requestUrl;
  } catch {
    return requestUrl;
  }
}

export function shouldAttachPlatformAuthorization(requestUrl: string, allowedOrigins: ReadonlySet<string>) {
  try {
    const url = new URL(requestUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return allowedOrigins.has(url.origin);
  } catch {
    return false;
  }
}

export function isLaunchableStudioStatus(status: string | null | undefined) {
  return status === 'running' || status === 'sleeping' || status === 'stopped';
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function refreshPlatformAccessToken(
  session: PlatformSession,
  fetchImpl: typeof fetch = fetch,
): Promise<PlatformSession> {
  const response = await fetchImpl(`${session.baseUrl}/v1/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  if (!response.ok) {
    throw new Error(`Platform token refresh failed with HTTP ${response.status}`);
  }

  const tokens = await readJson<{ accessToken: string; refreshToken: string }>(response);
  return {
    ...session,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export async function fetchPlatformJson<T>(
  session: PlatformSession,
  path: string,
  organizationId: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const response = await fetchImpl(`${session.baseUrl}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
      ...(organizationId ? { 'x-organization-id': organizationId } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Platform request ${path} failed with HTTP ${response.status}`);
  }

  return readJson<T>(response);
}

export async function fetchPlatformProjects(
  session: PlatformSession,
  fetchImpl: typeof fetch = fetch,
): Promise<PlatformFetchResult> {
  const orgResponse = await fetchPlatformJson<{ organizations: PlatformOrganization[] }>(
    session,
    '/v1/auth/orgs',
    session.organizationId,
    fetchImpl,
  );
  const organizationId =
    session.organizationId ||
    orgResponse.organizations.find(org => org.isCurrent)?.id ||
    orgResponse.organizations[0]?.id;

  if (!organizationId) {
    return {
      organizations: orgResponse.organizations,
      projects: [],
    };
  }

  const projectsResponse = await fetchPlatformJson<{ projects: PlatformProject[] }>(
    session,
    '/v1/studio/projects',
    organizationId,
    fetchImpl,
  );

  return {
    organizations: orgResponse.organizations,
    organizationId,
    projects: projectsResponse.projects,
  };
}
