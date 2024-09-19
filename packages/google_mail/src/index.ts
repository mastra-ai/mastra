import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';

// @ts-ignore
import Google_MailLogo from './assets/google_mail.svg';
import { openapi } from './openapi';
import { components } from './openapi-components';
import { paths } from './openapi-paths';

type Google_MailConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class Google_MailIntegration extends Integration {
  availableScopes = [
    {
      key: `https://mail.google.com/`,
      description: `Read, compose, send, and permanently delete all your email from Gmail`,
    },
    {
      key: `https://www.googleapis.com/auth/gmail.addons.current.action.compose`,
      description: `Manage drafts and send emails when you interact with the add-on`,
    },
    {
      key: `https://www.googleapis.com/auth/gmail.addons.current.message.action`,
      description: `View your email messages when you interact with the add-on`,
    },
    {
      key: `https://www.googleapis.com/auth/gmail.addons.current.message.metadata`,
      description: `View your email message metadata when the add-on is running`,
    },
    {
      key: `https://www.googleapis.com/auth/gmail.addons.current.message.readonly`,
      description: `View your email messages when the add-on is running`,
    },
    {
      key: `https://www.googleapis.com/auth/gmail.compose`,
      description: `Manage drafts and send emails`,
    },
    {
      key: `https://www.googleapis.com/auth/gmail.insert`,
      description: `Add emails into your Gmail mailbox`,
    },
    {
      key: `https://www.googleapis.com/auth/gmail.labels`,
      description: `See and edit your email labels`,
    },
    {
      key: `https://www.googleapis.com/auth/gmail.metadata`,
      description: `View your email message metadata such as labels and headers, but not the email body`,
    },
    {
      key: `https://www.googleapis.com/auth/gmail.modify`,
      description: `Read, compose, and send emails from your Gmail account`,
    },
    {
      key: `https://www.googleapis.com/auth/gmail.readonly`,
      description: `View your email messages and settings`,
    },
    {
      key: `https://www.googleapis.com/auth/gmail.send`,
      description: `Send email on your behalf`,
    },
    {
      key: `https://www.googleapis.com/auth/gmail.settings.basic`,
      description: `See, edit, create, or change your email settings and filters in Gmail`,
    },
    {
      key: `https://www.googleapis.com/auth/gmail.settings.sharing`,
      description: `Manage your sensitive mail settings, including who can manage your mail`,
    },
  ];

  constructor({ config }: { config: Google_MailConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'GOOGLE_MAIL',
      logoUrl: Google_MailLogo,
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
      endpoint: `https://gmail.googleapis.com/`,
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
        SERVER: `https://gmail.googleapis.com`,
        AUTHORIZATION_ENDPOINT: `https://accounts.google.com/o/oauth2/v2/auth`,
        TOKEN_ENDPOINT: `https://oauth2.googleapis.com/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
