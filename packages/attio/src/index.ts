import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';

// @ts-ignore
import AttioLogo from './assets/attio.svg';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type AttioConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class AttioIntegration extends Integration {
  categories = ['crm'];
  description = 'Powerful, flexible and data-driven, Attio makes it easy to build the exact CRM your business needs.';
  availableScopes = [
    {
      key: `user_management:read`,
      description: `View workspace members.`,
    },
    {
      key: `user_management:read-write`,
      description: `View workspace members.`,
    },
    {
      key: `record_permission:read`,
      description: `View, and optionally write, records.`,
    },
    {
      key: `record_permission:read-write`,
      description: `View, and optionally write, records.`,
    },
    {
      key: `object_configuration:read`,
      description: `View, and optionally write, the configuration and attributes of objects.`,
    },
    {
      key: `object_configuration:read-write`,
      description: `View, and optionally write, the configuration and attributes of objects.`,
    },
    {
      key: `list_entry:read`,
      description: `View, and optionally write, the entries in a list.`,
    },
    {
      key: `list_entry:read-write`,
      description: `View, and optionally write, the entries in a list.`,
    },
    {
      key: `list_configuration:read`,
      description: `View, and optionally write, the configuration and attributes of lists.`,
    },
    {
      key: `list_configuration:read-write`,
      description: `View, and optionally write, the configuration and attributes of lists.`,
    },
    {
      key: `public_collection:read`,
      description: `View, and optionally write, both the settings and information within public collections.`,
    },
    {
      key: `public_collection:read-write`,
      description: `View, and optionally write, both the settings and information within public collections.`,
    },
    {
      key: `private_collection:read`,
      description: `View, and optionally modify, both the settings and information of all collections within the workspace, regardless of their access settings.`,
    },
    {
      key: `private_collection:read-write`,
      description: `View, and optionally modify, both the settings and information of all collections within the workspace, regardless of their access settings.`,
    },
    {
      key: `comment:read`,
      description: `View comments (and threads), and optionally write comments.`,
    },
    {
      key: `comment:read-write`,
      description: `View comments (and threads), and optionally write comments.`,
    },
    {
      key: `task:read`,
      description: `View, and optionally write, tasks.`,
    },
    {
      key: `task:read-write`,
      description: `View, and optionally write, tasks.`,
    },
    {
      key: `note:read`,
      description: `View, and optionally write, notes.`,
    },
    {
      key: `note:read-write`,
      description: `View, and optionally write, notes.`,
    },
    {
      key: `webhook:read`,
      description: `View, and optionally manage, webhooks.`,
    },
    {
      key: `webhook:read-write`,
      description: `View, and optionally manage, webhooks.`,
    },
  ];

  constructor({ config }: { config: AttioConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'ATTIO',
      logoUrl: AttioLogo,
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
      baseUrl: 'https://app.attio.com',
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
        SERVER: `https://app.attio.com`,
        AUTHORIZATION_ENDPOINT: `https://app.attio.com/authorize`,
        TOKEN_ENDPOINT: `https://app.attio.com/oauth/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
