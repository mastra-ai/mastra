import type {
  ListToolProviderConnectionsResponse,
  ListToolProviderToolkitsResponse,
  ListToolProvidersResponse,
} from '@mastra/client-js';

export const composioProviders: ListToolProvidersResponse = {
  providers: [{ id: 'composio', name: 'Composio', displayName: 'Composio' }],
};

export const composioToolkits: ListToolProviderToolkitsResponse = {
  data: [{ slug: 'gmail', name: 'Gmail' }],
};

export const adminConnections: ListToolProviderConnectionsResponse = {
  items: [
    { connectionId: 'conn_shared', status: 'active', authorId: 'shared', label: 'Shared' },
    { connectionId: 'conn_b', status: 'active', authorId: 'user_B', label: 'B' },
    { connectionId: 'conn_a', status: 'active', authorId: 'user_A', label: 'A' },
  ],
};
