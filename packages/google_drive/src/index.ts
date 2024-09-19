import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';

// @ts-ignore
import Google_DriveLogo from './assets/google_drive.svg';
import { openapi } from './openapi';
import { components } from './openapi-components';
import { paths } from './openapi-paths';

type Google_DriveConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class Google_DriveIntegration extends Integration {
  availableScopes = [
    {
      key: `https://www.googleapis.com/auth/drive`,
      description: `See, edit, create, and delete all of your Google Drive files`,
    },
    {
      key: `https://www.googleapis.com/auth/drive.appdata`,
      description: `See, create, and delete its own configuration data in your Google Drive`,
    },
    {
      key: `https://www.googleapis.com/auth/drive.apps.readonly`,
      description: `View your Google Drive apps`,
    },
    {
      key: `https://www.googleapis.com/auth/drive.file`,
      description: `See, edit, create, and delete only the specific Google Drive files you use with this app`,
    },
    {
      key: `https://www.googleapis.com/auth/drive.metadata`,
      description: `View and manage metadata of files in your Google Drive`,
    },
    {
      key: `https://www.googleapis.com/auth/drive.metadata.readonly`,
      description: `See information about your Google Drive files`,
    },
    {
      key: `https://www.googleapis.com/auth/drive.photos.readonly`,
      description: `View the photos, videos and albums in your Google Photos`,
    },
    {
      key: `https://www.googleapis.com/auth/drive.readonly`,
      description: `See and download all your Google Drive files`,
    },
    {
      key: `https://www.googleapis.com/auth/drive.scripts`,
      description: `Modify your Google Apps Script scripts' behavior`,
    },
  ];

  constructor({ config }: { config: Google_DriveConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'GOOGLE_DRIVE',
      logoUrl: Google_DriveLogo,
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
      endpoint: `https://www.googleapis.com/drive/v3`,
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
        SERVER: `https://www.googleapis.com/drive/v3`,
        AUTHORIZATION_ENDPOINT: `https://accounts.google.com/o/oauth2/v2/auth`,
        TOKEN_ENDPOINT: `https://oauth2.googleapis.com/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
