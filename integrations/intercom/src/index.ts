import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';

// @ts-ignore
import IntercomLogo from './assets/intercom.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type IntercomConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class IntercomIntegration extends Integration {
  categories = ['communications', 'crm', 'support'];
  description = 'Intercom is a customer messaging platform that helps businesses connect with customers.';

  constructor({ config }: { config: IntercomConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'INTERCOM',
      logoUrl: IntercomLogo,
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
      baseUrl: 'https://api.intercom.io',
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
        SERVER: `https://api.intercom.io`,
        AUTHORIZATION_ENDPOINT: `https://app.intercom.com/oauth`,
        TOKEN_ENDPOINT: `https://api.intercom.io/auth/eagle/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
