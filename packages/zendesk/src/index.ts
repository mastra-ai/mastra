import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';

// @ts-ignore
import ZendeskLogo from './assets/zendesk.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type ZendeskConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  ZENDESK_SUBDOMAIN: string;
  [key: string]: any;
};

export class ZendeskIntegration extends Integration {
  categories = ['support', 'crm', 'automation', 'hr'];
  description = 'Zendesk is a customer service software company that provides a cloud-based customer support platform.';

  constructor({ config }: { config: ZendeskConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'ZENDESK',
      logoUrl: ZendeskLogo,
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
      baseUrl: 'https://${this.config.ZENDESK_SUBDOMAIN}.zendesk.com',
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
        SERVER: `https://${this.config.ZENDESK_SUBDOMAIN}.zendesk.com`,
        AUTHORIZATION_ENDPOINT: `https://${this.config.ZENDESK_SUBDOMAIN}.zendesk.com/oauth/authorizations/new`,
        TOKEN_ENDPOINT: `https://${this.config.ZENDESK_SUBDOMAIN}.zendesk.com/oauth/tokens`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
