import { Connection, Integration, IntegrationApi, IntegrationAuth } from '@mastra/core';

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
    { key: 'tweet.read', description: 'Read Tweets' },
    { key: 'tweet.write', description: 'Write Tweets' },
    { key: 'follows.read', description: 'Read follows' },
    { key: 'follows.write', description: 'Manage follows' },
    { key: 'offline.access', description: 'Maintain OAuth access' },
    { key: 'like.read', description: 'Read likes' },
    { key: 'like.write', description: 'Manage likes' },
    { key: 'bookmark.read', description: 'Read bookmarks' },
    { key: 'bookmark.write', description: 'Manage bookmarks' },
    { key: 'block.read', description: 'Read blocks' },
    { key: 'block.write', description: 'Manage blocks' },
    { key: 'users.read', description: 'Read user information' },
    { key: 'tweet.moderate.write', description: 'Moderate Tweets' },
    { key: 'mute.write', description: 'Manage mutes' },
    { key: 'mute.read', description: 'Read mutes' },
    { key: 'list.write', description: 'Manage lists' },
    { key: 'list.read', description: 'Read lists' },
    { key: 'space.read', description: 'Read Spaces' },
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

  makeClient = async ({ connectionId }: { connectionId: string }) => {
    const authenticator = this.getAuthenticator();
    const connection = await this.dataLayer?.getConnection({ connectionId, name: this.name });

    if (!connection) throw new Error('No connection found');

    const token = await authenticator.getAuthToken({ k_id: connection?.id });

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

  async onDisconnect({ connectionId }: { connectionId: string }) {}

  getAuthenticator() {
    const isScopesDefined = this.config.SCOPES && this.config.SCOPES.length > 0; // TODO: remove this once we a document, and we can define the scopes
    const fallbackScopes = this.availableScopes?.map(scope => scope.key) || [];
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
        SCOPES: isScopesDefined ? this.config.SCOPES : fallbackScopes,
        EXTRA_AUTH_PARAMS: {
          code_challenge: 'challenge',
          code_challenge_method: 'plain',
        },
      },
    });
  }
}
