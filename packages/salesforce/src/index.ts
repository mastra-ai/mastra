import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';

// @ts-ignore
import SalesforceLogo from './assets/salesforce.png';
import { openapi } from './openapi';
import { components } from './openapi-components';
import { paths } from './openapi-paths';

type SalesforceConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class SalesforceIntegration extends Integration {
  constructor({ config }: { config: SalesforceConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'SALESFORCE',
      logoUrl: SalesforceLogo,
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
      endpoint: `http://salesforce.local`,
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
        SERVER: `https://api.salesforce.com`,
        AUTHORIZATION_ENDPOINT: `https://login.salesforce.com/services/oauth2/authorize`,
        TOKEN_ENDPOINT: `https://login.salesforce.com/services/oauth2/token`,
        SCOPES: [],
      },
    });
  }
}
