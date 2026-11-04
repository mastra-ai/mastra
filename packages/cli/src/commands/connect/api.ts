import {
  createApiClient,
  extractApiErrorDetail,
  MASTRA_PLATFORM_API_URL,
  platformFetch,
  throwApiError,
} from '../auth/client.js';

/**
 * Derive the integrations service URL from the platform URL when not
 * explicitly set. If the platform points at staging, integrations defaults to
 * staging too — same convention as the gateway/studio URL derivation in
 * `auth/client.ts`.
 */
export function getIntegrationsApiUrl(): string {
  if (process.env.MASTRA_INTEGRATIONS_API_URL) return process.env.MASTRA_INTEGRATIONS_API_URL.replace(/\/+$/, '');
  if (MASTRA_PLATFORM_API_URL.includes('staging')) return 'https://integrations.staging.mastra.ai';
  return 'https://integrations.mastra.ai';
}

/**
 * One form field the provider needs before (or instead of) its consent
 * screen. Mirrors the platform catalog's `authFields` contract; only the
 * properties the CLI renders are typed here.
 */
export interface IntegrationAuthField {
  name: string;
  /** Where the value goes in the Nango auth call: request body vs query params. */
  target: 'credentials' | 'params';
  label: string;
  description: string | null;
  placeholder: string | null;
  defaultValue: string | null;
  options: string[] | null;
  documentationUrl: string | null;
  /** Only render this field when another field holds a specific value. */
  visibleWhen: { field: string; equals: string } | null;
  secret: boolean;
  required: boolean;
  order: number;
}

export interface IntegrationCatalogEntry {
  id: string;
  displayName: string;
  logoUrl: string | null;
  authType: string | null;
  authFields: IntegrationAuthField[];
  comingSoon: boolean;
}

export interface ProjectConnection {
  id: string;
  integrationId: string;
  status: string;
  accountLabel: string | null;
  displayName: string | null;
  connectedByUserId: string;
  connectedAt: string | null;
  createdAt: string;
}

export interface OrgMember {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface ConnectSession {
  connectionId: string;
  integrationId: string;
  /** Nango hosted Connect UI URL — fallback for auth types the CLI can't drive. */
  connectUrl: string;
  /** Nango connect session token for the headless auth flow. */
  sessionToken: string;
  expiresAt: string;
}

function headers(token: string, orgId: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'x-organization-id': orgId,
  };
}

export async function fetchIntegrationCatalog(token: string, orgId: string): Promise<IntegrationCatalogEntry[]> {
  const resp = await platformFetch(`${getIntegrationsApiUrl()}/v2/integrations`, { headers: headers(token, orgId) });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throwApiError('Failed to fetch integration catalog', resp.status, extractApiErrorDetail(err));
  }
  const data = (await resp.json()) as { integrations: IntegrationCatalogEntry[] };
  return data.integrations;
}

export async function fetchProjectConnections(
  token: string,
  orgId: string,
  projectId: string,
): Promise<ProjectConnection[]> {
  const resp = await platformFetch(
    `${getIntegrationsApiUrl()}/v2/projects/${encodeURIComponent(projectId)}/connections`,
    {
      headers: headers(token, orgId),
    },
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throwApiError('Failed to fetch project connections', resp.status, extractApiErrorDetail(err));
  }
  const data = (await resp.json()) as { connections?: ProjectConnection[] };
  return data.connections ?? [];
}

/**
 * Org-level connections for one provider, including connections that are not
 * attached to any project yet. Used to offer reuse before creating a new one.
 */
export async function fetchOrgConnections(
  token: string,
  orgId: string,
  integrationId: string,
): Promise<ProjectConnection[]> {
  const resp = await platformFetch(
    `${getIntegrationsApiUrl()}/v2/connections?providerKey=${encodeURIComponent(integrationId)}`,
    { headers: headers(token, orgId) },
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throwApiError('Failed to fetch connections', resp.status, extractApiErrorDetail(err));
  }
  const data = (await resp.json()) as { connections?: ProjectConnection[] };
  return data.connections ?? [];
}

/**
 * Rename a connection. The platform trims the name and caps it at 100
 * characters; renaming requires the org admin role.
 */
export async function updateConnectionDisplayName(
  token: string,
  orgId: string,
  connectionId: string,
  displayName: string,
): Promise<void> {
  const resp = await platformFetch(`${getIntegrationsApiUrl()}/v2/connections/${encodeURIComponent(connectionId)}`, {
    method: 'PATCH',
    headers: { ...headers(token, orgId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throwApiError('Failed to set the display name', resp.status, extractApiErrorDetail(err));
  }
}

/** Attach an existing org-level connection to the project. */
export async function addConnectionToProject(
  token: string,
  orgId: string,
  projectId: string,
  connectionId: string,
): Promise<void> {
  const resp = await platformFetch(
    `${getIntegrationsApiUrl()}/v2/projects/${encodeURIComponent(projectId)}/connections/${encodeURIComponent(connectionId)}`,
    { method: 'POST', headers: headers(token, orgId) },
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throwApiError('Failed to add connection to project', resp.status, extractApiErrorDetail(err));
  }
}

/**
 * Mint a connect session scoped to the project: the resulting connection is
 * attached to the project as soon as the provider authorizes it.
 */
export async function createProjectConnectSession(
  token: string,
  orgId: string,
  projectId: string,
  integrationId: string,
): Promise<ConnectSession> {
  const resp = await platformFetch(
    `${getIntegrationsApiUrl()}/v2/projects/${encodeURIComponent(projectId)}/integrations/${encodeURIComponent(integrationId)}/connect-sessions`,
    { method: 'POST', headers: headers(token, orgId) },
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throwApiError('Failed to create connect session', resp.status, extractApiErrorDetail(err));
  }
  return (await resp.json()) as ConnectSession;
}

/** Org members, used to attribute label-less connections to whoever connected them. */
export async function fetchOrgMembers(token: string, orgId: string): Promise<OrgMember[]> {
  const client = createApiClient(token, orgId);
  const { data, error, response } = await client.GET('/v1/org/members');
  if (error) {
    throwApiError('Failed to fetch org members', response.status, extractApiErrorDetail(error));
  }
  return data.members;
}

/** Unlink a connection from the project. The org-level connection survives. */
export async function removeProjectConnection(
  token: string,
  orgId: string,
  projectId: string,
  connectionId: string,
): Promise<void> {
  const resp = await platformFetch(
    `${getIntegrationsApiUrl()}/v2/projects/${encodeURIComponent(projectId)}/connections/${encodeURIComponent(connectionId)}`,
    { method: 'DELETE', headers: headers(token, orgId) },
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throwApiError('Failed to remove connection', resp.status, extractApiErrorDetail(err));
  }
}
