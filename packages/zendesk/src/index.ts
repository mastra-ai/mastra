import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';

// @ts-ignore
import ZendeskLogo from './assets/zendesk.svg';
import { openapi } from './openapi';
import { paths, components } from './openapi-def';

type ZendeskConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  ZENDESK_SUBDOMAIN: string;
  [key: string]: any;
};

export class ZendeskIntegration extends Integration {
  constructor({ config }: { config: ZendeskConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'ZENDESK',
      logoUrl: ZendeskLogo,
    });
  }

  getOpenApiSpec() {
    return { paths, components } as unknown as OpenAPI;
  }

  getApiClient = async ({ connectionId }: { connectionId: string }): Promise<OASClient<NormalizeOAS<openapi>>> => {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId });

    if (!connection) {
      throw new Error(`Connection not found for connectionId: ${connectionId}`);
    }

    const authenticator = this.getAuthenticator();
    const { accessToken } = await authenticator.getAuthToken({ k_id: connection.id });

    const client = createClient<NormalizeOAS<openapi>>({
      endpoint: `https://${this.config.ZENDESK_SUBDOMAIN}.zendesk.com` as 'https://{subdomain}.{domain}.com',
      globalParams: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    return client as any;
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
        SCOPES: ['users:read', 'impersonate'],
      },
    });
  }
}
