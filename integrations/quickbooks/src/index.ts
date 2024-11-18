import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';

// @ts-ignore
import QuickbooksLogo from './assets/quickbooks.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type QuickbooksConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class QuickbooksIntegration extends Integration {
  categories = ['accounting'];
  description = 'QuickBooks is an accounting software package developed and marketed by Intuit.';

  constructor({ config }: { config: QuickbooksConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'QUICKBOOKS',
      logoUrl: QuickbooksLogo,
    });
  }

  getClientZodSchema() {
    return zodSchema;
  }

  getCommentsForClientApis() {
    return comments;
  }

  getBaseClient() {
    integrationClient.client.setConfig({
      baseUrl: `https://quickbooks.api.intuit.com/v3/company/${this.config.REALM_ID}`,
    });
    return integrationClient;
  }

  getApiClient = async ({ connectionId }: { connectionId: string }) => {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId });

    if (!connection) {
      throw new Error(`Connection not found for connectionId: ${connectionId}`);
    }

    const authenticator = this.getAuthenticator();
    const { accessToken } = await authenticator.getAuthToken({ k_id: connection.id });

    const baseClient = this.getBaseClient();

    baseClient.client.interceptors.request.use((request, options) => {
      request.headers.set('Authorization', `Bearer ${accessToken}`);
      return request;
    });

    return integrationClient;
  };

  registerEvents() {
    this.events = {};
    return this.events;
  }

  getAuthenticator() {
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      // @ts-ignore
      onConnectionCreated: () => {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: `https://quickbooks.api.intuit.com/v3/company/${this.config.REALM_ID}`,
        AUTHORIZATION_ENDPOINT: `https://appcenter.intuit.com/connect/oauth2`,
        TOKEN_ENDPOINT: `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
