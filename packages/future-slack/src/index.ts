import { DataIntegration } from '@prisma/client';

import { IntegrationAPI } from '../api';
import { IntegrationAuth } from '../authenticator';
import { IntegrationPlugin } from '../plugin';
import { MakeAPI, IntegrationCredentialType, IntegrationAction } from '../types';

import { CREATE_NEW_CHANNEL } from './actions/create-new-channel';
import { INVITE_TO_CHANNEL } from './actions/invite-to-channel';
import { SEND_MESSAGE_TO_CHANNEL } from './actions/send-message-to-channel';
import { SlackClient } from './client';
import { SLACK_INTEGRATION_NAME, SLACK_LOGO_URL } from './constants';

type SlackConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  REDIRECT_URI: string;
  [key: string]: any;
};

export class SlackIntegration extends IntegrationPlugin {
  config: SlackConfig;

  constructor({ config }: { config: SlackConfig }) {
    config.authType = IntegrationCredentialType.OAUTH;

    super({
      config,
      name: SLACK_INTEGRATION_NAME,
      logoUrl: SLACK_LOGO_URL,
    });

    this.config = config;
  }

  makeClient = async ({ api }: { api: IntegrationAPI }) => {
    const authenticator = this.getAuthenticator({ api });

    const connection = await api.getConnectionByName(this.name);

    if (!connection) throw new Error('No connection found');

    const token = await authenticator.getAuthToken({ connectionId: connection?.id });

    return new SlackClient({ token: token.accessToken });
  };

  getActions({ makeAPI }: { makeAPI: MakeAPI }): Record<string, IntegrationAction<any>> {
    return {
      SEND_MESSAGE_TO_CHANNEL: SEND_MESSAGE_TO_CHANNEL({ makeAPI, makeClient: this.makeClient }),
      CREATE_NEW_CHANNEL: CREATE_NEW_CHANNEL({ makeAPI, makeClient: this.makeClient }),
      INVITE_TO_CHANNEL: INVITE_TO_CHANNEL({ makeAPI, makeClient: this.makeClient }),
    };
  }

  async onConnectionCreated({ api, connection }: { api: IntegrationAPI; connection: DataIntegration }) {}

  async onDisconnect({ api }: { api: IntegrationAPI }) {}

  getAuthenticator({ api }: { api: IntegrationAPI }): IntegrationAuth {
    const baseScope = [
      'channels:manage',
      'users:read',
      'channels:write.invites',
      'chat:write',
      'channels:read',
      'groups:read',
      'channels:join',
      'groups:write.invites',
      'groups:read',
      'groups:write',
    ];

    return new IntegrationAuth({
      api,
      onConnectionCreated: async connection => {
        return this.onConnectionCreated({ api, connection });
      },
      config: {
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI,
        AUTH_TYPE: this.config.authType,
        SERVER: 'https://slack.com',
        DISCOVERY_ENDPOINT: '/.well-known/openid-configuration',
        AUTHORIZATION_ENDPOINT: '/oauth/v2/authorize',
        TOKEN_ENDPOINT: '/api/oauth.v2.access',
        REVOCATION_ENDPOINT: '/api/auth.revoke',
        SCOPES: [...baseScope],
        INTEGRATION_NAME: this.name,
        EXTRA_AUTH_PARAMS: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
  }
}
