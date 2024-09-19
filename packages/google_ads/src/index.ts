import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';

// @ts-ignore
import Google_AdsLogo from './assets/google_ads.svg';
import { openapi } from './openapi';
import { components } from './openapi-components';
import { paths } from './openapi-paths';

type Google_AdsConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class Google_AdsIntegration extends Integration {
  availableScopes = [
    {
      key: `https://www.googleapis.com/auth/adsense`,
      description: `View and manage your AdSense data`,
    },
    {
      key: `https://www.googleapis.com/auth/adsense.readonly`,
      description: `View your AdSense data`,
    },
  ];

  constructor({ config }: { config: Google_AdsConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'GOOGLE_ADS',
      logoUrl: Google_AdsLogo,
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
      endpoint: `https://adsense.googleapis.com/`,
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
        SERVER: `https://adsense.googleapis.com`,
        AUTHORIZATION_ENDPOINT: `https://accounts.google.com/o/oauth2/v2/auth`,
        TOKEN_ENDPOINT: `https://www.googleapis.com/oauth2/v3/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
