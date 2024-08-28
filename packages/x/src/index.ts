import { Connection, Integration, IntegrationAuth } from '@arkw/core';

//@ts-ignore
import xIcon from './assets/x.svg';
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
