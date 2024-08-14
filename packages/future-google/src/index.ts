import { DataIntegration, IntegrationAuth, IntegrationPlugin } from 'core';
import { z } from 'zod';

import { SEND_BULK_EMAIL, SEND_EMAIL } from './actions/send-email';
import { GoogleClient } from './client';
import { emailSync } from './events';
import {
  createGooglePersonWorksheetFields,
  getValidRecipientAddresses,
  isEmailValidForSync,
  isSentEmail,
  nameForContact,
} from './helpers';
import { Connection, CreateEmailType, CreateEmailsParams, Email, EmailAddress } from './types';

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

  async fetchEmails({
    emails,
    options,
    contacts,
    connectionId,
  }: {
    emails: Email[];
    connectionId: string;
    options?: {
      peopleRecordTypeId: string;
      connectedEmail: string;
      syncTableId: string;
      recordSearchCache: Set<string>;
    };
    contacts: Record<string, Connection>;
  }) {
    const emailsToSave: CreateEmailType[] = [];
    const personRecordsToCreate: Record<string, any>[] = [];

    for (const message of emails) {
      if (!message.to) {
        continue;
      }

      let recipients: EmailAddress[] = isSentEmail(message) ? message.to : [message.from];
      recipients = getValidRecipientAddresses({ addresses: recipients, connectedEmail: options?.connectedEmail });
      if (recipients?.length < 1) continue;

      if (!isEmailValidForSync({ email: message.from?.address || '', connectedEmail: options?.connectedEmail }))
        continue;

      for (const recipient of recipients) {
        if (!options) continue;

        if (!recipient.address || recipient.address == options.connectedEmail) {
          continue;
        }
        let isRecordExistingInCache = options.recordSearchCache.has(recipient.address);
        if (!isRecordExistingInCache) {
          if (!recipient.address) return null;

          const existingRecord = await this.dataLayer?.getRecordByFieldNameAndValue({
            fieldName: 'email',
            fieldValue: recipient.address,
            type: `CONTACTS`,
            connectionId,
          });

          if (existingRecord) {
            options.recordSearchCache.add(recipient.address);
            continue;
          }

          const recordName = await nameForContact({
            nameFromService: recipient.name,
            emailAddress: recipient.address,
            contacts,
          });

          personRecordsToCreate.push({
            firstName: recordName.firstName ? recordName.firstName : '',
            lastName: recordName.lastName ? recordName.lastName : '',
            email: recipient.address,
          });
        }
      }

      const toAdresses = message.to.reduce((prev: string[], curr) => {
        if (curr.address) prev.push(curr.address);
        return prev;
      }, []);

      const ccAdresses = message.cc?.reduce((prev: string[], curr) => {
        if (curr.address) prev.push(curr.address);
        return prev;
      }, []);

      const bccAdresses = message.bcc?.reduce((prev: string[], curr) => {
        if (curr.address) prev.push(curr.address);
        return prev;
      }, []);

      const email: CreateEmailType = {
        messageId: message.messageId,
        emailId: message.id,
        threadId: message.threadId,
        subject: message.subject || '',
        labelIds: message.labelIds,
        snippet: message.snippet,
        from: message.from.address || '',
        to: toAdresses,
        cc: ccAdresses,
        bcc: bccAdresses,
        text: message.text,
        html: message.html,
        date: new Date(message.date || ''),
      };

      emailsToSave.push(email);
    }
    return { emailsToSave, personRecordsToCreate };
  }

  async createEmails({ emails, options, contacts, connectionId }: CreateEmailsParams) {
    const response = await this.fetchEmails({
      emails,
      options,
      contacts,
      connectionId,
    });

    if (!response) {
      throw new Error('Error creating emails');
    }

    await this.sendEvent({
      name: this.getEventKey('EMAIL_SYNC'),
      data: {
        contacts,
      },
      user: {
        connectionId,
      },
    });
  }

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
        key: 'google.mail/sync.table',
        schema: z.object({
          syncTableId: z.string(),
        }),
      },
      GCAL_SYNC: {
        key: 'google.calendar/sync.table',
        schema: z.object({
          syncTableId: z.string(),
        }),
      },
      EMAIL_SYNC: {
        key: 'google.emails/sync.table',
        schema: z.object({
          syncTableId: z.string(),
        }),
      },
    };
    return this.events;
  }

  getEventHandlers() {
    return [
      emailSync({
        name: this.name,
        event: this.getEventKey('EMAIL_SYNC'),
        dataLayer: this.dataLayer!,
      }),
    ];
  }

  async createSyncTable({
    integrationId,
    connectionId,
    shouldSync = true,
  }: {
    connectionId: string;
    integrationId: string;
    shouldSync?: boolean;
  }) {
    const existingSyncTable = await this.dataLayer?.getSyncTableByDataIdAndType({
      type: `CONTACTS`,
      dataIntegrationId: integrationId,
    });
    let syncTable;

    if (existingSyncTable) {
      syncTable = existingSyncTable;
    } else {
      syncTable = await this.dataLayer?.createSyncTable({
        dataIntegrationId: integrationId,
        type: `CONTACTS`,
        connectionId,
      });

      if (syncTable) {
        await this.dataLayer?.addFieldsToSyncTable({
          syncTableId: syncTable.id!,
          fields: createGooglePersonWorksheetFields(),
        });
      }
    }

    // if (shouldSync && syncTable) {
    //   const gmailEvent = await this.sendEvent({
    //     name: this.getEventKey('GMAIL_SYNC'),
    //     data: {
    //       syncTableId: syncTable.id,
    //     },
    //     user: {
    //       connectionId,
    //     },
    //   });

    //   const gcalEvent = await this.sendEvent({
    //     name: this.getEventKey('GCAL_SYNC'),
    //     data: {
    //       syncTableId: syncTable.id,
    //     },
    //     user: {
    //       connectionId,
    //     },
    //   });

    //   await this.dataLayer?.updateSyncTableLastSyncId({
    //     syncTableId: syncTable.id,
    //     syncId: gcalEvent.ids[0], // iffy about this
    //   });
    // }
    return syncTable;
  }

  async onDataIntegrationCreated({ integration }: { integration: DataIntegration }) {
    // if (process.env.GOOGLE_MAIL_TOPIC as string) {
    //   await this.sendEvent({
    //     name: this.getEventKey('GMAIL_SUBSCRIBE'),
    //     data: {
    //       connectionId: integration.id,
    //     },
    //     user: {
    //       connectionId: integration.connectionId,
    //     },
    //   });
    // }

    // await this.sendEvent({
    //   name: this.getEventKey('GCAL_SUBSCRIBE'),
    //   data: {
    //     connectionId: integration.id,
    //   },
    //   user: {
    //     connectionId: integration.connectionId,
    //   },
    // });

    return this.createSyncTable({
      connectionId: integration.connectionId,
      integrationId: integration.id,
    });
  }

  async onDisconnect({ connectionId }: { connectionId: string }) {
    const integration = await this.dataLayer?.getDataIntegrationByConnectionId({ connectionId, name: this.name });

    const client = await this.makeClient({ connectionId });

    await client.stopCalendarChannel();

    const connectedSyncTable = await this.dataLayer?.getSyncTableByDataIdAndType({
      dataIntegrationId: integration?.id!,
      type: `CONTACTS`,
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
