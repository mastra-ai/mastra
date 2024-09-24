import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';

// @ts-ignore
import ShopifyLogo from './assets/shopify.png';
import { openapi } from './openapi';
import { components } from './openapi-components';
import { paths } from './openapi-paths';

type ShopifyConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  SHOPIFY_SUBDOMAIN: string;
  [key: string]: any;
};

export class ShopifyIntegration extends Integration {
  constructor({ config }: { config: ShopifyConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'SHOPIFY',
      logoUrl: ShopifyLogo,
    });
  }

  getOpenApiSpec() {
    return { paths, components } as unknown as OpenAPI;
  }

  getApiClient = async ({ referenceId }: { referenceId: string }): Promise<OASClient<NormalizeOAS<openapi>>> => {
    const connection = await this.dataLayer?.getConnectionByReferenceId({ name: this.name, referenceId });

    if (!connection) {
      throw new Error(`Connection not found for referenceId: ${referenceId}`);
    }

    const authenticator = this.getAuthenticator();
    const { accessToken } = await authenticator.getAuthToken({ connectionId: connection.id });

    const client = createClient<NormalizeOAS<openapi>>({
      endpoint: `https://${this.config.SHOPIFY_SUBDOMAIN}.myshopify.com`,
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
        SERVER: `https://${this.config.SHOPIFY_SUBDOMAIN}.myshopify.com`,
        AUTHORIZATION_ENDPOINT: `https://${this.config.SHOPIFY_SUBDOMAIN}.myshopify.com/admin/oauth/authorize`,
        TOKEN_ENDPOINT: `https://${this.config.SHOPIFY_SUBDOMAIN}.myshopify.com/admin/oauth/access_token`,
        SCOPES: [],
      },
    });
  }
}
