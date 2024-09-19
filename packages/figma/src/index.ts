import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';

// @ts-ignore
import FigmaLogo from './assets/figma.svg';
import { openapi } from './openapi';
import { components } from './openapi-components';
import { paths } from './openapi-paths';

type FigmaConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class FigmaIntegration extends Integration {
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
      endpoint: `https://api.figma.com`,
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
        SERVER: `https://api.figma.com`,
        AUTHORIZATION_ENDPOINT: `https://www.figma.com/oauth`,
        TOKEN_ENDPOINT: `https://www.figma.com/api/oauth/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
