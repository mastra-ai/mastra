import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';

// @ts-ignore
import NotionLogo from './assets/notion.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type NotionConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class NotionIntegration extends Integration {
  categories = ['support', 'crm', 'productivity', 'spreadsheet'];
  description = 'Notion is an all-in-one workspace for notes, tasks, wikis, and databases.';

  constructor({ config }: { config: NotionConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'NOTION',
      logoUrl: NotionLogo,
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
      baseUrl: 'https://api.notion.com',
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
        SERVER: `https://api.notion.com`,
        AUTHORIZATION_ENDPOINT: `https://api.notion.com/v1/oauth/authorize`,
        TOKEN_ENDPOINT: `https://api.notion.com/v1/oauth/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
