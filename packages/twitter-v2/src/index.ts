import { Connection, Integration, IntegrationAuth } from '@arkw/core';

//@ts-ignore
import twitterIcon from './assets/twitter.svg';
import { TWITTER_INTEGRATION_NAME } from './constants';

type TwitterV2Config = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  REDIRECT_URI: string;
  [key: string]: any;
};

export class TwitterV2Integration extends Integration {
  config: TwitterV2Config;

  constructor({ config }: { config: TwitterV2Config }) {
    config.authType = `OAUTH`;

    super({
      ...config,
      name: TWITTER_INTEGRATION_NAME,
      logoUrl: twitterIcon,
    });

    this.config = config;
  }

  async onConnectionCreated({ connection }: { connection: Connection }) {}

  async onDisconnect({ connectionId }: { connectionId: string }) {}

  getAuthenticator() {
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
        TOKEN_ENDPOINT: '/2/oauth2/token',
        SCOPES: [],
      },
    });
  }
}
