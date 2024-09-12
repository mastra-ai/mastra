import { Connection, Integration, IntegrationApi, IntegrationAuth } from '@kpl/core';

import { CREATE_POST } from './apis/create-post';
//@ts-ignore
import xIcon from './assets/x.svg';
import { XClient } from './client';
import { X_INTEGRATION_NAME } from './constants';

type XConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  SCOPES: string[];
  REDIRECT_URI?: string;
  [key: string]: any;
};

export class XIntegration extends Integration {
  config: XConfig;
  availableScopes = [
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

  registerApis(): Record<string, IntegrationApi<any>> {
    this.apis = {
      CREATE_POST: CREATE_POST({
        dataAccess: this?.dataLayer!,
        name: this.name,
        makeClient: this.makeClient,
      }),
    };

    return this.apis;
  }

  async onConnectionCreated({ connection }: { connection: Connection }) {}

  async onDisconnect({ referenceId }: { referenceId: string }) {}

  getAuthenticator() {
    const isScopesDefined = this.config.SCOPES && this.config.SCOPES.length > 0; // TODO: remove this once we a document, and we can define the scopes
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
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: `https://twitter.com`,
        AUTHORIZATION_ENDPOINT: '/i/oauth2/authorize',
        TOKEN_ENDPOINT: 'https://api.twitter.com/2/oauth2/token',
        SCOPES: isScopesDefined ? this.config.SCOPES : this.availableScopes,
        EXTRA_AUTH_PARAMS: {
          code_challenge: 'challenge',
          code_challenge_method: 'plain',
        },
      },
    });
  }
}
