export type PlatformConnectProviderId = 'jira' | 'incident-io' | 'gitlab' | 'gitlab-self-hosted' | 'vanta' | 'linear';

export const MASTRA_PLATFORM_URL = 'https://projects.mastra.ai';

/** How the provider authorizes: OAuth consent popup or an API-key form. */
export type PlatformConnectAuthKind = 'oauth' | 'apiKey';

/** A connection setting an API-key provider needs besides the key, such as a self-hosted instance's hostname. */
export interface PlatformConnectParam {
  key: string;
  label: string;
  placeholder: string;
}

export interface PlatformConnectProviderMeta {
  id: PlatformConnectProviderId;
  displayName: string;
  authKind: PlatformConnectAuthKind;
  /** What an API-key provider calls its key. Defaults to "API key". */
  credentialName?: string;
  params?: readonly PlatformConnectParam[];
}

export const PLATFORM_CONNECT_PROVIDERS: Record<PlatformConnectProviderId, PlatformConnectProviderMeta> = {
  jira: { id: 'jira', displayName: 'Jira', authKind: 'oauth' },
  'incident-io': { id: 'incident-io', displayName: 'incident.io', authKind: 'apiKey' },
  gitlab: { id: 'gitlab', displayName: 'GitLab', authKind: 'oauth' },
  'gitlab-self-hosted': {
    id: 'gitlab-self-hosted',
    displayName: 'self-hosted GitLab',
    authKind: 'apiKey',
    credentialName: 'access token',
    params: [{ key: 'hostname', label: 'Instance hostname', placeholder: 'gitlab.example.com' }],
  },
  vanta: { id: 'vanta', displayName: 'Vanta', authKind: 'oauth' },
  linear: { id: 'linear', displayName: 'Linear', authKind: 'oauth' },
};

export interface PlatformProviderConnection {
  id: string;
  integrationId: string;
  status: 'active' | 'needs_reauth';
  accountLabel: string | null;
  displayName?: string | null;
}

/**
 * The provider whose flow reconnects `connection`. A self-hosted GitLab
 * connection is listed under GitLab but reconnects with its token form.
 */
export function reconnectProvider(
  provider: PlatformConnectProviderId,
  connection: { integrationId: string },
): PlatformConnectProviderId {
  return connection.integrationId === 'gitlab-self-hosted' ? 'gitlab-self-hosted' : provider;
}

export function connectionName(connection: PlatformProviderConnection): string {
  return connection.displayName?.trim() || connection.accountLabel?.trim() || 'Connected account';
}

const platformIcons = {
  gitlab: 'gitlab',
  'gitlab-self-hosted': 'gitlab',
  jira: 'jira',
  'incident-io': 'incidentio',
  vanta: 'vanta',
  linear: 'linear',
} as const satisfies Record<PlatformConnectProviderId, string>;

/** The integration icon and name `IntegrationItem` takes for a Platform provider. */
export function platformIntegration(provider: PlatformConnectProviderId) {
  return { provider: platformIcons[provider], name: PLATFORM_CONNECT_PROVIDERS[provider].displayName };
}

/**
 * How the host connects a provider account. Each resolves with the active
 * connection, or `null` when authorization finished but the connection is
 * still activating.
 */
export interface PlatformConnectActions {
  connect: (
    provider: PlatformConnectProviderId,
    input: { credentials?: Record<string, string>; params?: Record<string, string> },
  ) => Promise<PlatformProviderConnection | null>;
  reconnect: (
    provider: PlatformConnectProviderId,
    input: { connectionId: string; credentials?: Record<string, string> },
  ) => Promise<PlatformProviderConnection | null>;
}
