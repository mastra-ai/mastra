import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';

// @ts-ignore
import FigmaLogo from './assets/figma.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type FigmaConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class FigmaIntegration extends Integration {
  categories = ['dev-tools', 'productivity'];
  description = 'Figma is a cloud-based design tool that is used to create user interfaces, websites, and apps.';
  availableScopes = [
    {
      key: `files:read`,
      description: `Read files, projects, users, versions, comments, components & styles, and webhooks.`,
    },
    {
      key: `file_variables:read`,
      description: `Read variables in Figma file. Note: this is only available to members in Enterprise organizations.`,
    },
    {
      key: `file_variables:write`,
      description: `Write to variables in Figma file. Note: this is only available to members in Enterprise organizations.`,
    },
    {
      key: `file_comments:write`,
      description: `Post and delete comments and comment reactions in files.`,
    },
    {
      key: `file_dev_resources:read`,
      description: `Read dev resources in files.`,
    },
    {
      key: `file_dev_resources:write`,
      description: `Write to dev resources in files.`,
    },
    {
      key: `library_analytics:read`,
      description: `Read library analytics data.`,
    },
    {
      key: `webhooks:write`,
      description: `Create and manage webhooks.`,
    },
  ];

  constructor({ config }: { config: FigmaConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'FIGMA',
      logoUrl: FigmaLogo,
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
      baseUrl: `https://api.figma.com`,
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
        SERVER: `https://api.figma.com`,
        AUTHORIZATION_ENDPOINT: `https://www.figma.com/oauth`,
        TOKEN_ENDPOINT: `https://www.figma.com/api/oauth/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
