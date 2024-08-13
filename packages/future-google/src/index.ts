import { DataIntegration, IntegrationAuth, IntegrationPlugin } from 'core';
import { z } from 'zod';

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
