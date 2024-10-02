import { Integration, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';

// @ts-ignore
import AsanaLogo from './assets/asana.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type AsanaConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class AsanaIntegration extends Integration {
  categories = ['project-management'];
  description = 'Asana is a project management platform that helps teams track, manage, and complete work.';
  availableScopes = [
    {
      key: `default`,
      description: `Provides access to all endpoints documented in our API reference. If no scopes are requested, this scope is assumed by default.`,
    },
    {
      key: `email`,
      description: `Provides access to the user’s email through the OpenID Connect user info endpoint.`,
    },
    {
      key: `openid`,
      description: `Provides access to OpenID Connect ID tokens and the OpenID Connect user info endpoint.`,
    },
    {
      key: `profile`,
      description: `Provides access to the user’s name and profile photo through the OpenID Connect user info endpoint.`,
    },
  ];

  constructor({ config }: { config: AsanaConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'ASANA',
      logoUrl: AsanaLogo,
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
      baseUrl: 'https://app.asana.com',
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
        SERVER: `https://app.asana.com`,
        AUTHORIZATION_ENDPOINT: `/-/oauth_authorize`,
        TOKEN_ENDPOINT: `/-/oauth_token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
