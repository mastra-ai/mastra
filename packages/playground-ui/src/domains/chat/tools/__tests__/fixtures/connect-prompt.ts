import type {
  ConnectPromptPayload,
  UserConnectSessionResponse,
  UserConnectionStatusResponse,
} from '../../../../connect';

/**
 * Structured output of the built-in `request_connection` tool, as produced by
 * `@mastra/connect`'s resolver: one provider already connected globally, one
 * not connected yet.
 */
export const connectPromptPayload: ConnectPromptPayload = {
  type: 'connect-prompt',
  requestedProvider: 'linear',
  providers: [
    {
      id: 'linear',
      displayName: 'Linear',
      logoUrl: 'https://logos.test/linear.png',
      authType: 'OAUTH2',
      authFields: null,
      connected: false,
      scope: null,
    },
    {
      id: 'notion',
      displayName: 'Notion',
      logoUrl: null,
      authType: 'OAUTH2',
      authFields: null,
      connected: true,
      scope: 'global',
    },
  ],
};

/** Session created for the Linear connect action; the popup goes to the launch gate. */
export const connectPromptSession: UserConnectSessionResponse = {
  connectionId: 'conn-chat-1',
  integrationId: 'linear',
  launchUrl: '/connect/connections/conn-chat-1/launch',
  expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
};

export const connectPromptStatusActive: UserConnectionStatusResponse = {
  id: 'conn-chat-1',
  status: 'active',
  scope: 'user',
};
