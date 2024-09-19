import { Integration, IntegrationAuth, IntegrationCredentialType } from '@kpl/core';

export class IrokoIntegration extends Integration {
  constructor({ config }: { config: Record<string, any> }) {
    super({
      name: 'Iroko',
      logoUrl: 'https://iroko.tv/favicon.ico',
    });
  }

  getAuthenticator() {
    return new IntegrationAuth({
      // @ts-ignore
      onConnectionCreated: () => {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: IntegrationCredentialType.OAUTH,
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: `https://app.asana.com`,
        AUTHORIZATION_ENDPOINT: '/-/oauth_authorize',
        TOKEN_ENDPOINT: '/-/oauth_token',
        SCOPES: [],
      },
      dataAccess: this.dataLayer!,
    });
  }
}
