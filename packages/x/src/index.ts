import { Connection, Integration, IntegrationAction, IntegrationAuth } from '@arkw/core';

import { CREATE_POST } from './actions/create-post';
//@ts-ignore
import xIcon from './assets/x.svg';
import { XClient } from './client';
import { X_INTEGRATION_NAME } from './constants';

type XConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  REDIRECT_URI: string;
  [key: string]: any;
};

export class XIntegration extends Integration {
  config: XConfig;

  constructor({ config }: { config: XConfig }) {
    config.authType = `OAUTH`;

    super({
      ...config,
      name: X_INTEGRATION_NAME,
      logoUrl: xIcon,
    });

    this.config = config;
  }

  makeClient = async ({ referenceId }: { referenceId: string }) => {
    const authenticator = this.getAuthenticator();
    const connection = await this.dataLayer?.getConnectionByReferenceId({ referenceId, name: this.name });

    if (!connection) throw new Error('No connection found');

    const token = await authenticator.getAuthToken({ connectionId: connection?.id });

    return new XClient({ token: token.accessToken });
  };

  registerActions(): Record<string, IntegrationAction<any>> {
    this.actions = {
      CREATE_POST: CREATE_POST({
        dataAccess: this?.dataLayer!,
        name: this.name,
        makeClient: this.makeClient,
      }),
    };

    return this.actions;
  }

  async onConnectionCreated({ connection }: { connection: Connection }) {}

  async onDisconnect({ connectionId }: { connectionId: string }) {}

  getAuthenticator() {
    const baseScope = [
      'tweet.read',
      'tweet.write',
      'follows.read',
      'follows.write',
      'offline.access',
      'like.read',
      'like.write',
      'bookmark.read',
      'bookmark.write',
      'block.read',
      'block.write',
      'users.read',
      'tweet.moderate.write',
      'mute.write',
      'mute.read',
      'list.write',
      'list.read',
      'space.read',
    ];
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      onConnectionCreated: connection => {
        return this.onConnectionCreated({ connection });
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI,
        SERVER: `https://twitter.com`,
        AUTHORIZATION_ENDPOINT: '/i/oauth2/authorize',
        TOKEN_ENDPOINT: 'https://api.twitter.com/2/oauth2/token',
        SCOPES: [...baseScope],
        EXTRA_AUTH_PARAMS: {
          code_challenge: 'challenge',
          code_challenge_method: 'plain',
        },
      },
    });
  }
}
