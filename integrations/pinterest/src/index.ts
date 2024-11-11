import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';

// @ts-ignore
import PinterestLogo from './assets/pinterest.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type PinterestConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class PinterestIntegration extends Integration {
  categories = ['social_media'];
  description = 'Pinterest is a social media platform that allows users to discover and save ideas.';
  availableScopes = [
    {
      key: `ads:read`,
      description: `See all of your advertising data, including ads, ad groups, campaigns etc.`,
    },
    {
      key: `ads:write`,
      description: `Create, update, or delete ads, ad groups, campaigns etc.`,
    },
    {
      key: `billing:read`,
      description: `See all of your billing data, billing profile, etc.`,
    },
    {
      key: `billing:write`,
      description: `Create, update, or delete billing data, billing profiles, etc.`,
    },
    {
      key: `biz_access:read`,
      description: `See business access data`,
    },
    {
      key: `biz_access:write`,
      description: `Create, update, or delete business access data`,
    },
    {
      key: `boards:read`,
      description: `See your public boards, including group boards you join`,
    },
    {
      key: `boards:read_secret`,
      description: `See your secret boards`,
    },
    {
      key: `boards:write`,
      description: `Create, update, or delete your public boards`,
    },
    {
      key: `boards:write_secret`,
      description: `Create, update, or delete your secret boards`,
    },
    {
      key: `catalogs:read`,
      description: `See all of your catalogs data`,
    },
    {
      key: `catalogs:write`,
      description: `Create, update, or delete your catalogs data`,
    },
    {
      key: `pins:read`,
      description: `See your public Pins`,
    },
    {
      key: `pins:read_secret`,
      description: `See your secret Pins`,
    },
    {
      key: `pins:write`,
      description: `Create, update, or delete your public Pins`,
    },
    {
      key: `pins:write_secret`,
      description: `Create, update, or delete your secret Pins`,
    },
    {
      key: `user_accounts:read`,
      description: `See your user accounts and followers`,
    },
    {
      key: `user_accounts:write`,
      description: `Update your user accounts and followers`,
    },
  ];

  constructor({ config }: { config: PinterestConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'PINTEREST',
      logoUrl: PinterestLogo,
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
      baseUrl: 'https://api.pinterest.com/v5',
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
        SERVER: `https://api.pinterest.com/v5`,
        AUTHORIZATION_ENDPOINT: `https://www.pinterest.com/oauth`,
        TOKEN_ENDPOINT: `https://api.pinterest.com/v5/oauth/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
