import type {
  ListToolProviderConnectionsResponse,
  ListToolProviderToolkitsResponse,
  ListToolProviderToolsResponse,
  ListToolProvidersResponse,
} from '@mastra/client-js';

export const composioProviderList: ListToolProvidersResponse = {
  providers: [
    {
      id: 'composio',
      name: 'Composio',
      capabilities: {
        multipleConnectionsPerToolkit: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
      },
    },
  ],
};

export const composioToolkits: ListToolProviderToolkitsResponse = {
  data: [{ slug: 'gmail', name: 'Gmail' }],
};

export const composioGmailTools: ListToolProviderToolsResponse = {
  data: [
    {
      slug: 'GMAIL_FETCH_EMAILS',
      name: 'Fetch emails',
      description: 'Fetch emails from Gmail',
      toolkit: 'gmail',
    },
  ],
};

export const composioGmailConnections: ListToolProviderConnectionsResponse = {
  items: [
    {
      connectionId: 'conn-gmail',
      status: 'active',
      label: 'Gmail',
      authorId: 'user-1',
      createdAt: '2026-04-29T10:00:00.000Z',
    },
  ],
  pagination: {
    total: 1,
    page: 1,
    perPage: 50,
    hasMore: false,
  },
};
