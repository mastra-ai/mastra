import type {
  UserConnectErrorBody,
  UserConnectProvidersResponse,
  UserConnectSessionResponse,
  UserConnectionStatusResponse,
  UserConnectionsResponse,
} from '@mastra/playground-ui/domains/connect';

export const providersResponse: UserConnectProvidersResponse = {
  providers: [
    {
      id: 'linear',
      displayName: 'Linear',
      logoUrl: 'https://logos.example.com/linear.svg',
      authType: 'OAUTH2',
      authFields: null,
    },
    {
      id: 'slack',
      displayName: 'Slack',
      logoUrl: null,
      authType: 'OAUTH2',
      authFields: null,
    },
  ],
};

export const mixedConnectionsResponse: UserConnectionsResponse = {
  connections: [
    {
      id: 'conn-global-1',
      // Outside providersResponse: display metadata comes from the row itself
      // (the server resolves it against the full catalog, not the
      // policy-filtered provider list).
      integrationId: 'notion',
      displayName: 'Notion',
      logoUrl: 'https://logos.example.com/notion.svg',
      status: 'active',
      accountLabel: 'Acme workspace',
      scope: 'global',
    },
    {
      id: 'conn-user-1',
      integrationId: 'linear',
      displayName: 'Linear',
      logoUrl: 'https://logos.example.com/linear.svg',
      status: 'active',
      accountLabel: 'you@example.com',
      scope: 'user',
    },
  ],
};

export const globalOnlyConnectionsResponse: UserConnectionsResponse = {
  connections: mixedConnectionsResponse.connections.filter(connection => connection.scope === 'global'),
};

export const sessionResponse: UserConnectSessionResponse = {
  connectionId: 'conn-user-2',
  integrationId: 'slack',
  // Server-relative launch-gate path; no launch capability (vendor OAuth URL
  // or session token) is ever exposed to the browser.
  launchUrl: '/connect/connections/conn-user-2/launch',
  expiresAt: '2026-10-13T23:59:59.000Z',
};

export const statusPending: UserConnectionStatusResponse = {
  id: 'conn-user-2',
  status: 'pending',
  scope: 'user',
};

export const statusActive: UserConnectionStatusResponse = {
  id: 'conn-user-2',
  status: 'active',
  scope: 'user',
};

export const unauthorizedBody: UserConnectErrorBody = {
  error: {
    code: 'unauthorized',
    message:
      'No end-user identity for this request. Configure server.auth with mapUserToResourceId, or pass a resourceId callback to userConnectRoutes().',
  },
};
