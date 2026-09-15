import type { ListToolProviderConnectionsResponse } from '@mastra/client-js';

type ConnectionItem = ListToolProviderConnectionsResponse['items'][number];

export const makeConnection = (connectionId: string, overrides: Partial<ConnectionItem> = {}): ConnectionItem => ({
  connectionId,
  status: 'active',
  ...overrides,
});

export const twoGmailConnections: ListToolProviderConnectionsResponse = {
  items: [makeConnection('conn_work', { label: 'work' }), makeConnection('conn_personal', { label: 'personal' })],
};

export const oneGmailConnection: ListToolProviderConnectionsResponse = {
  items: [makeConnection('conn_only', { label: 'only' })],
};

export const noConnections: ListToolProviderConnectionsResponse = {
  items: [],
};
