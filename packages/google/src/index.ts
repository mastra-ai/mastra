import { Connection, IntegrationAuth, Integration, nextHeaders, FilterObject } from '@arkw/core';
import { z } from 'zod';

import { SEND_BULK_EMAIL, SEND_EMAIL } from './actions/send-email';
//@ts-ignore
import googleIcon from './assets/google.svg';
import { GoogleClient } from './client';
import { CONTACT_FIELDS } from './constants';
import { gcalSubscribe, gmailSubscribe } from './events/subscribe';
import { calendarSync, contactSync, emailSync, gcalSyncSyncTable, gmailSyncSyncTable } from './events/sync';
import { gCalSyncUpdate, gmailSyncUpdate } from './events/update';
import {
  UpdateEmailsParam,
  updateCalendarsParam,
  GoogleEntityTypes,
  CreateEmailsParams,
  createCalendarEventsParams,
  IGoogleEntityFields,
} from './types';

type GoogleConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  TOPIC: string;
  [key: string]: any;
};

export class GoogleIntegration extends Integration<GoogleClient> {
  config: GoogleConfig;
  entityTypes = { CONTACTS: 'CONTACTS', CALENDAR: 'CALENDAR', EMAIL: 'EMAIL' };

  constructor({ config }: { config: GoogleConfig }) {
    config.authType = `OAUTH`;

    super({
      ...config,
      name: 'GOOGLE',
      logoUrl: googleIcon,
    });

    this.config = config;
  }

  async getProxy({ referenceId }: { referenceId: string }) {
    const c = await this.makeClient({ referenceId });
    const calendar = await c.getCalendarInstance();
    const gmail = await c.getGmailInstance();
    return {
      calendar,
      gmail,
    };
  }

  registerActions() {
    this.actions = {
      SEND_EMAIL: SEND_EMAIL({
        dataAccess: this?.dataLayer!,
        name: this.name,
        makeClient: this.makeClient,
        createEmails: this.createEmails.bind(this),
      }),
      SEND_BULK_EMAIL: SEND_BULK_EMAIL({
        dataAccess: this?.dataLayer!,
        name: this.name,
        makeClient: this.makeClient,
        createEmails: this.createEmails.bind(this),
      }),
    };
    return this.actions;
  }

  registerEvents() {
    this.events = {
      'sync.gcalSubscribe': {
        schema: z.object({
          connectionId: z.string(),
        }),
        handler: gcalSubscribe,
      },
      'sync.gmailSubscribe': {
        schema: z.object({
          connectionId: z.string(),
          topic: z.string(),
        }),
        handler: gmailSubscribe,
      },
      'sync.gmailUpdated': {
        schema: z.object({
          emailAddress: z.string(),
          historyId: z.string(),
        }),
        handler: gmailSyncUpdate,
      },
      'sync.gCalUpdated': {
        schema: z.object({}),
        handler: gCalSyncUpdate,
      },
      'google.mail/sync.table': {
        schema: z.object({
          options: z
            .object({
              duration: z.number(),
            })
            .optional(),
        }),
        handler: gmailSyncSyncTable,
      },
      'google.calendar/sync.table': {
        schema: z.object({
          options: z
            .object({
              duration: z.number(),
            })
            .optional(),
        }),
        handler: gcalSyncSyncTable,
      },
      'google.emails/sync': {
        schema: z.object({
          emails: z.record(z.any()),
          entityType: z.string(),
        }),
        handler: emailSync,
      },
      'google.calendar/sync': {
        schema: z.object({
          calendarEvents: z.record(z.any()),
          entityType: z.string(),
        }),
        handler: calendarSync,
      },
      'google.contacts/sync': {
        schema: z.object({
          contacts: z.record(z.any()),
          entityType: z.string(),
        }),
        handler: contactSync,
      },
    };

    return this.events;
  }

  makeClient = async ({ referenceId }: { referenceId: string }) => {
    const authenticator = this.getAuthenticator();

    const connection = await this.dataLayer?.getConnectionByReferenceId({ referenceId, name: this.name });

    if (!connection) throw new Error('No connection found');

    const token = await authenticator.getAuthToken({ connectionId: connection?.id });

    return new GoogleClient({ token: token.accessToken });
  };

  createEmails = async ({ emails, options, contacts, referenceId }: CreateEmailsParams) => {
    const client = await this.makeClient({ referenceId });

    const response = await client.fetchEmails({
      emails,
      options,
      contacts,
      referenceId,
    });

    if (!response) {
      throw new Error('Error creating emails');
    }

    const { emailsToSave, personRecordsToCreate } = response;

    await this.sendEvent({
      key: 'google.contacts/sync',
      data: {
        contacts: personRecordsToCreate,
        entityType: this.entityTypes.CONTACTS,
      },
      user: {
        referenceId,
      },
    });

    await this.sendEvent({
      key: 'google.emails/sync',
      data: {
        emails: emailsToSave,
        entityType: this.entityTypes.EMAIL,
      },
      user: {
        referenceId,
      },
    });
  };

  createCalendarEvents = async ({ connectedEmail, duration, person, referenceId }: createCalendarEventsParams) => {
    const client = await this.makeClient({ referenceId });

    const { eventsToSave, peopleRecordsToCreate } = await client.fetchCalendarEvents({
      connectedEmail,
      duration,
      person,
    });

    await this.sendEvent({
      key: 'google.contacts/sync',
      data: {
        contacts: peopleRecordsToCreate,
        entityType: this.entityTypes.CONTACTS,
      },
      user: {
        referenceId,
      },
    });

    await this.sendEvent({
      key: 'google.calendar/sync',
      data: {
        calendarEvents: eventsToSave,
        entityType: this.entityTypes.CALENDAR,
      },
      user: {
        referenceId,
      },
    });
  };

  updateEmails = async ({ contacts, emails, referenceId }: UpdateEmailsParam) => {
    await this.createEmails({
      contacts,
      emails,
      referenceId,
    });
  };

  updateCalendars = async ({ referenceId }: updateCalendarsParam) => {
    await this.sendEvent({
      key: 'google.calendar/sync.table',
      data: {},
      user: {
        referenceId,
      },
    });
  };

  async createEntity({
    referenceId,
    connectionId,
    shouldSync = true,
  }: {
    connectionId: string;
    referenceId: string;
    shouldSync?: boolean;
  }) {
    const existingEntity = await this.dataLayer?.getEntityByConnectionAndType({
      type: `CONTACTS`,
      connectionId,
    });

    let entity;

    if (existingEntity) {
      entity = existingEntity;
    } else {
      entity = await this.dataLayer?.createEntity({
        connectionId,
        type: `CONTACTS`,
        referenceId,
      });

      if (entity) {
        await this.dataLayer?.addPropertiesToEntity({
          entityId: entity.id!,
          properties: CONTACT_FIELDS,
        });
      }
    }

    if (shouldSync && entity) {
      await this.sendEvent({
        key: 'google.mail/sync.table',
        data: {
          entityId: entity.id,
        },
        user: {
          referenceId,
        },
      });

      const gcalEvent = await this.sendEvent({
        key: 'google.calendar/sync.table',
        data: {
          entityId: entity.id,
        },
        user: {
          referenceId,
        },
      });

      await this.dataLayer?.updateEntityLastSyncId({
        entityId: entity.id,
        syncId: gcalEvent.ids[0], // iffy about this
      });
    }

    return entity;
  }

  async query<T extends GoogleEntityTypes>({
    referenceId,
    entityType,
    filters,
    sort,
  }: {
    referenceId: string;
    entityType: T;
    filters?: FilterObject<IGoogleEntityFields<T>>;
    sort?: string[];
  }): Promise<any> {
    const connection = await this.dataLayer?.getConnectionByReferenceId({ referenceId, name: this.name });

    if (!connection) {
      throw new Error('No connection found');
    }

    const recordData = await this.dataLayer?.getRecords({
      connectionId: connection.id,
      entityType,
      filters,
      sort,
    });

    return recordData;
  }

  processWebhookRequest = async ({
    event,
    reqBody,
    connectionsBySubscriptionId,
  }: {
    event: string;
    reqBody: Record<string, any>;
    connectionsBySubscriptionId: (subscriptionId: string) => Promise<Connection[]>;
  }) => {
    if (event === 'sync.gmailUpdated') {
      const message = reqBody.message;
      const emailAddress = message.emailAddress;
      const historyId = message.historyId;

      const connections = await connectionsBySubscriptionId(emailAddress);

      connections.forEach(async connection => {
        this.sendEvent({
          key: event,
          data: {
            emailAddress,
            historyId,
          },
          user: {
            referenceId: connection?.referenceId,
          },
        });
      });
    } else if (event === 'sync.gCalUpdated') {
      const headersList = nextHeaders();
      const subscriptionId = headersList.get('X-Goog-Resource-Id');

      if (!subscriptionId) {
        throw new Error('No X-Goog-Channel-Id found in headers');
      }

      const connections = await connectionsBySubscriptionId(subscriptionId);

      connections?.forEach(async connection => {
        this.sendEvent({
          key: event,
          data: {},
          user: {
            referenceId: connection?.referenceId,
          },
        });
      });
    }
  };

  async onConnectionCreated({ connection }: { connection: Connection }) {
    if (this.config.GOOGLE_MAIL_TOPIC) {
      await this.sendEvent({
        key: 'sync.gmailSubscribe',
        data: {
          connectionId: connection.id,
          topic: this.config.GOOGLE_MAIL_TOPIC,
        },
        user: {
          referenceId: connection.referenceId,
        },
      });
    }

    await this.sendEvent({
      key: 'sync.gcalSubscribe',
      data: {
        connectionId: connection.id,
      },
      user: {
        referenceId: connection.referenceId,
      },
    });

    return this.createEntity({
      referenceId: connection.referenceId,
      connectionId: connection.id,
    });
  }

  async onDisconnect({ referenceId }: { referenceId: string }) {
    const connection = await this.dataLayer?.getConnectionByReferenceId({ referenceId, name: this.name });

    const client = await this.makeClient({ referenceId });

    await client.stopCalendarChannel({
      channelId: connection?.id!,
      subscriptionId: connection?.subscriptionId!,
    });

    const connectedEntity = await this.dataLayer?.getEntityByConnectionAndType({
      connectionId: connection?.id!,
      type: `CONTACTS`,
    });

    if (connectedEntity) {
      await this.dataLayer?.deleteEntityById(connectedEntity.id);
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
      onConnectionCreated: connection => {
        return this.onConnectionCreated({ connection });
      },
      config: {
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
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
