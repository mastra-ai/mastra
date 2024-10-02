import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';

// @ts-ignore
import Google_DocsLogo from './assets/google_docs.svg';
import { openapi } from './openapi';
import { components } from './openapi-components';
import { paths } from './openapi-paths';

type Google_DocsConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class Google_DocsIntegration extends Integration {
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
      endpoint: `https://docs.googleapis.com/`,
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
        SERVER: `https://docs.googleapis.com`,
        AUTHORIZATION_ENDPOINT: `https://accounts.google.com/o/oauth2/v2/auth`,
        TOKEN_ENDPOINT: `https://oauth2.googleapis.com/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
