import type { ListToolProviderToolkitsResponse, ListToolProvidersResponse } from '@mastra/client-js';

export const composioProvider: ListToolProvidersResponse = {
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
  data: [
    { slug: 'gmail', name: 'Gmail' },
    { slug: 'slack', name: 'Slack' },
  ],
};
