import type { McpServerInfo } from '../../../../../../../api/types';

export const DOCS_ID = '11111111-1111-4111-8111-111111111111';
export const CRM_ID = '22222222-2222-4222-8222-222222222222';

/** A connected bearer-token server with one selected tool and one new, unselected tool. */
export const docsServer: McpServerInfo = {
  id: DOCS_ID,
  name: 'Docs',
  slug: 'docs',
  url: 'https://docs.example.com/mcp',
  authType: 'headers',
  headerNames: ['Authorization'],
  status: 'connected',
  lastError: null,
  discoveredAt: '2026-11-04T12:00:00.000Z',
  tools: [
    { name: 'add', exposedName: 'docs_add', description: 'Add two numbers.', selected: false, isNew: true },
    {
      name: 'search',
      exposedName: 'docs_search',
      title: 'Search docs',
      description: 'Search the documentation.',
      selected: true,
      isNew: false,
      annotations: { readOnlyHint: true },
    },
  ],
};

/** An OAuth server nobody has signed in to yet. */
export const crmServer: McpServerInfo = {
  id: CRM_ID,
  name: 'CRM',
  slug: 'crm',
  url: 'https://crm.example.com/mcp',
  authType: 'oauth',
  headerNames: [],
  oauth: { clientId: 'factory-client', hasClientSecret: true, scopes: ['read'], connected: false },
  status: 'needs_auth',
  lastError: 'Sign in to connect this server.',
  discoveredAt: null,
  tools: [],
};
