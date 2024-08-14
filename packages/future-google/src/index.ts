import { DataIntegration, IntegrationAuth, IntegrationPlugin } from 'core';
import { z } from 'zod';

import { SEND_BULK_EMAIL, SEND_EMAIL } from './actions/send-email';
import { GoogleClient } from './client';

type GoogleConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  REDIRECT_URI: string;
  TOPIC: string;
  [key: string]: any;
};

export class GoogleIntegration extends IntegrationPlugin {
  config: GoogleConfig;

  constructor({ config }: { config: GoogleConfig }) {
    config.authType = `OAUTH`;

    super({
      ...config,
      name: 'GOOGLE',
      logoUrl: '/images/integrations/google.svg',
    });

    this.config = config;
  }

  makeClient = async ({ connectionId }: { connectionId: string }) => {
    const authenticator = this.getAuthenticator();

    const integration = await this.dataLayer?.getDataIntegrationByConnectionId({ connectionId, name: this.name });

    if (!integration) throw new Error('No connection found');

    const token = await authenticator.getAuthToken({ integrationId: integration?.id });

    return new GoogleClient({ token: token.accessToken });
  };

  async createEmails() {}

  getActions() {
    return {
      SEND_EMAIL: SEND_EMAIL({
        dataAccess: this?.dataLayer!,
        name: this.name,
        makeClient: this.makeClient,
        createEmails: this.createEmails,
      }),
      SEND_BULK_EMAIL: SEND_BULK_EMAIL({
        dataAccess: this?.dataLayer!,
        name: this.name,
        makeClient: this.makeClient,
        createEmails: this.createEmails,
      }),
    };
  }

  defineEvents() {
    this.events = {
      GCAL_SUBSCRIBE: {
        key: `sync.gcalSubscribe`,
        schema: z.object({
          connectionId: z.string(),
        }),
      },
      GMAIL_SUBSCRIBE: {
        key: 'sync.gmailSubscribe',
        schema: z.object({
          connectionId: z.string(),
        }),
      },
      GMAIL_UPDATE: {
        key: 'sync.gmailUpdated',
        schema: z.object({
          emailAddress: z.string(),
          historyId: z.string(),
        }),
      },
      GCAL_UPDATE: {
        key: 'sync.gCalUpdated',
        schema: z.object({
          connectionId: z.string(),
        }),
      },
      GMAIL_SYNC: {
        key: 'google.mail/sync.worksheet',
        schema: z.object({
          worksheetId: z.string(),
        }),
      },
      GCAL_SYNC: {
        key: 'google.calendar/sync.worksheet',
        schema: z.object({
          worksheetId: z.string(),
        }),
      },
    };
    return this.events;
  }

  onDataIntegrationCreated({ integration }: { integration: DataIntegration }) {}

  async onDisconnect({ connectionId }: { connectionId: string }) {
    const integration = await this.dataLayer?.getDataIntegrationByConnectionId({ connectionId, name: this.name });

    const client = await this.makeClient({ connectionId });

    await client.stopCalendarChannel();

    const connectedSyncTable = await this.dataLayer?.getSyncTableByDataIdAndType({
      dataIntegrationId: integration?.id!,
      type: `EMAIL`,
    });

    if (connectedSyncTable) {
      await this.dataLayer?.deleteSyncTableById(connectedSyncTable.id);
    }
  }

  getAuthenticator() {
    const baseScope = ['openid', 'email', 'https://www.googleapis.com/auth/contacts'];

    const gmailScope = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.settings.basic',
    ];

    const calendarScope = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      onDataIntegrationCreated: integration => {
        return this.onDataIntegrationCreated({ integration });
      },
      config: {
        REDIRECT_URI: this.config.REDIRECT_URI,
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        SERVER: 'https://accounts.google.com',
        DISCOVERY_ENDPOINT: '/.well-known/openid-configuration',
        SCOPES: [...baseScope, ...gmailScope, ...calendarScope],
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
        EXTRA_AUTH_PARAMS: {
          prompt: 'consent',
          access_type: 'offline',
        },
      },
    });
  }
}
