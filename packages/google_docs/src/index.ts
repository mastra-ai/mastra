import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';

// @ts-ignore
import Google_DocsLogo from './assets/google_docs.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type Google_DocsConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class Google_DocsIntegration extends Integration {
  categories = ['storage', 'accounting', 'communications'];
  description = 'Google Docs is a word processor included as part of a free, web-based software office suite.';
  availableScopes = [
    {
      key: `https://www.googleapis.com/auth/documents`,
      description: `See, edit, create, and delete all your Google Docs documents`,
    },
    {
      key: `https://www.googleapis.com/auth/documents.readonly`,
      description: `See all your Google Docs documents`,
    },
    {
      key: `https://www.googleapis.com/auth/drive`,
      description: `See, edit, create, and delete all of your Google Drive files`,
    },
    {
      key: `https://www.googleapis.com/auth/drive.file`,
      description: `See, edit, create, and delete only the specific Google Drive files you use with this app`,
    },
    {
      key: `https://www.googleapis.com/auth/drive.readonly`,
      description: `See and download all your Google Drive files`,
    },
  ];

  constructor({ config }: { config: Google_DocsConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'GOOGLE_DOCS',
      logoUrl: Google_DocsLogo,
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
      baseUrl: 'https://docs.googleapis.com',
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
        SERVER: `https://docs.googleapis.com`,
        AUTHORIZATION_ENDPOINT: `https://accounts.google.com/o/oauth2/v2/auth`,
        TOKEN_ENDPOINT: `https://oauth2.googleapis.com/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
