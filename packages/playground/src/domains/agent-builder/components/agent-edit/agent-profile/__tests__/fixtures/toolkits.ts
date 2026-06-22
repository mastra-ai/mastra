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

export const GMAIL_ICON_URL = 'https://example.com/icons/gmail.png';

export const composioToolkits: ListToolProviderToolkitsResponse = {
  data: [
    { slug: 'gmail', name: 'Gmail', icon: GMAIL_ICON_URL },
    { slug: 'slack', name: 'Slack' },
  ],
};
