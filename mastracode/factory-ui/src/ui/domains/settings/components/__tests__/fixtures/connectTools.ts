import type { ConnectToolsSettings } from '../../../../../../api/types';
import type { PlatformCatalogProvider, PlatformProviderConnection } from '../../../../factory/services/platformConnect';

export const adminToolSettings: ConnectToolsSettings = {
  available: true,
  canEdit: true,
  enabledProviders: ['linear'],
};

export const toolCatalog: PlatformCatalogProvider[] = [
  { id: 'linear', displayName: 'Linear', logoUrl: null, authType: 'OAUTH2', mcp: false, authFields: [] },
  {
    id: 'notion-mcp',
    displayName: 'Notion MCP',
    logoUrl: null,
    authType: 'MCP_OAUTH2_GENERIC',
    mcp: true,
    authFields: [
      {
        name: 'serverUrl',
        target: 'params',
        label: 'Server URL',
        description: null,
        placeholder: 'https://mcp.example.com',
        secret: false,
        required: true,
      },
    ],
  },
  { id: 'slack', displayName: 'Slack', logoUrl: null, authType: 'OAUTH2', mcp: false, authFields: [] },
];

export const toolConnections: PlatformProviderConnection[] = [
  { id: 'linear-acme', integrationId: 'linear', status: 'active', accountLabel: 'Acme' },
  { id: 'slack-acme', integrationId: 'slack', status: 'active', accountLabel: 'Acme Slack' },
];
