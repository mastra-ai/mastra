import { Connection, IntegrationAction, IntegrationAuth, Integration } from '@arkw/core';

import { CREATE_NEW_CHANNEL } from './actions/create-new-channel';
import { INVITE_TO_CHANNEL } from './actions/invite-to-channel';
import { SEND_MESSAGE_TO_CHANNEL } from './actions/send-message-to-channel';
//@ts-ignore
import slackIcon from './assets/slack.svg';
import { SlackClient } from './client';
import { SLACK_INTEGRATION_NAME } from './constants';

type SlackConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  [key: string]: any;
};

export class SlackIntegration extends Integration<SlackClient> {
  config: SlackConfig;

  constructor({ config }: { config: SlackConfig }) {
    config.authType = `OAUTH`;

    super({
      config,
      name: SLACK_INTEGRATION_NAME,
      logoUrl: slackIcon,
    });

    this.config = config;
  }

  makeClient = async ({ referenceId }: { referenceId: string }) => {
    const authenticator = this.getAuthenticator();
    const connection = await this.dataLayer?.getConnectionByReferenceId({ referenceId, name: this.name });

    if (!connection) throw new Error('No connection found');

    const token = await authenticator.getAuthToken({ connectionId: connection?.id });

    return new SlackClient({ token: token.accessToken });
  };

  getActions(): Record<string, IntegrationAction<any>> {
    return {
      SEND_MESSAGE_TO_CHANNEL: SEND_MESSAGE_TO_CHANNEL({
        dataAccess: this?.dataLayer!,
        name: this.name,
        makeClient: this.makeClient,
      }),
      CREATE_NEW_CHANNEL: CREATE_NEW_CHANNEL({
        dataAccess: this?.dataLayer!,
        name: this.name,
        makeClient: this.makeClient,
      }),
      INVITE_TO_CHANNEL: INVITE_TO_CHANNEL({
        dataAccess: this?.dataLayer!,
        name: this.name,
        makeClient: this.makeClient,
      }),
    };
  }

  async onConnectionCreated({ connection }: { connection: Connection }) {}

  async onDisconnect({ connectionId }: { connectionId: string }) {}

  getAuthenticator(): IntegrationAuth {
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
      dataAccess: this.dataLayer!,
      onConnectionCreated: connection => {
        return this.onConnectionCreated({ connection });
      },
      config: {
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
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
