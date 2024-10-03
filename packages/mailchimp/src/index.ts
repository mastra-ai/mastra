import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';

// @ts-ignore
import MailchimpLogo from './assets/mailchimp.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type MailchimpConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class MailchimpIntegration extends Integration {
  categories = ['marketing', 'communications', 'crm'];
  description =
    'Mailchimp is an all-in-one marketing platform that helps you manage and talk to your clients, customers, and other interested parties.';

  constructor({ config }: { config: MailchimpConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'MAILCHIMP',
      logoUrl: MailchimpLogo,
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
      baseUrl: 'https://server.api.mailchimp.com/3.0',
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
        SERVER: `https://server.api.mailchimp.com/3.0`,
        AUTHORIZATION_ENDPOINT: `https://login.mailchimp.com/oauth2/authorize`,
        TOKEN_ENDPOINT: `https://login.mailchimp.com/oauth2/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
