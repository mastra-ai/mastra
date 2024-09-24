import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';

// @ts-ignore
import AttioLogo from './assets/attio.png';
import { openapi } from './openapi';
import { components } from './openapi-components';
import { paths } from './openapi-paths';

type AttioConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class AttioIntegration extends Integration {
  constructor({ config }: { config: AttioConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'ATTIO',
      logoUrl: AttioLogo,
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
      endpoint: `https://api.attio.com`,
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
        SERVER: `https://app.attio.com`,
        AUTHORIZATION_ENDPOINT: `https://app.attio.com/authorize`,
        TOKEN_ENDPOINT: `https://app.attio.com/oauth/token`,
        SCOPES: [],
      },
    });
  }
}
