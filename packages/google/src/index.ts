import { Connection, IntegrationAuth, Integration, MakeWebhookURL, nextHeaders } from '@arkw/core';
import { z } from 'zod';

import { SEND_BULK_EMAIL, SEND_EMAIL } from './actions/send-email';
//@ts-ignore
import googleIcon from './assets/google.svg';
import { GoogleClient } from './client';
import { gcalSubscribe, gmailSubscribe } from './events/subscribe';
import { calendarSync, contactSync, emailSync, gcalSyncSyncTable, gmailSyncSyncTable } from './events/sync';
import { gCalSyncUpdate, gmailSyncUpdate } from './events/update';
import {
  createGoogleContactsFields,
  getValidRecipientAddresses,
  haveSameDomain,
  isEmailValidForSync,
  isSentEmail,
  nameForContact,
} from './helpers';
import {
  CalendarEvent,
  GoogleConnection,
  CreateEmailType,
  CreateEmailsParams,
  Email,
  EmailAddress,
  UpdateEmailsParam,
  createCalendarEventsParams,
  updateCalendarsParam,
  GoogleEntityTypes,
} from './types';

type GoogleConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  REDIRECT_URI: string;
  TOPIC: string;
  [key: string]: any;
};

export class GoogleIntegration extends Integration {
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

  makeClient = async ({ referenceId }: { referenceId: string }) => {
    const authenticator = this.getAuthenticator();

    const connection = await this.dataLayer?.getConnectionByReferenceId({ referenceId, name: this.name });

    if (!connection) throw new Error('No connection found');

    const token = await authenticator.getAuthToken({ connectionId: connection?.id });

    return new GoogleClient({ token: token.accessToken });
  };

  async fetchEmails({
    emails,
    options,
    contacts,
    referenceId,
  }: {
    emails: Email[];
    referenceId: string;
    options?: {
      connectedEmail: string;
      entityId: string;
      recordSearchCache: Set<string>;
    };
    contacts: Record<string, GoogleConnection>;
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

          const existingRecord = await this.dataLayer?.getRecordByPropertyNameAndValue({
            propertyName: 'email',
            propertyValue: recipient.address,
            type: `CONTACTS`,
            referenceId,
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

  async fetchCalendarEvents({ connectedEmail, duration, options, person, referenceId }: createCalendarEventsParams) {
    const client = await this.makeClient({ referenceId });

    const isSinglePersonSync = person !== undefined;

    // getting events from all calendars for 1 year ago and 6 months in the future
    let currentDate = new Date();

    // Get the minDate (1 year ago)
    let minDate = new Date(currentDate);
    minDate.setFullYear(minDate.getFullYear() - 1);

    // Get the maxDate (6 months later)
    let maxDate = new Date(currentDate);
    maxDate.setMonth(maxDate.getMonth() + 6);

    // get calendar
    const calendar = await client.getCalendarById({
      calendarId: 'primary',
    });

    const calendarEvents = await client.getEventsForCalendar({
      startDate: duration ? duration.minDate : minDate,
      endDate: duration ? duration.maxDate : maxDate,
      calendarId: calendar.id,
      orderBy: 'startTime',
      singleEvents: true,
    });

    let peopleRecordsToCreate: Record<string, any>[] = [];
    let contacts: Record<string, GoogleConnection> = {};

    try {
      contacts = await client.findGoogleContactsHavingEmailAddress();
    } catch (error) {
      /* fail silently */
    }

    const eventResponseMap: Record<string, boolean> = {};

    // array of savable events
    let eventsToSave: CalendarEvent[] = [];

    for (const event of calendarEvents) {
      if (!event.attendees) continue;
      /**
     if the sync is for one record, check the attendees to make sure the event has that record as an attendee
     *
    */

      if (isSinglePersonSync) {
        let hasPersonEmail = false;

        for (const attendee of event.attendees) {
          if (attendee.email == person.email) hasPersonEmail = true;
        }

        if (!hasPersonEmail) continue;
      }

      for (const attendee of event.attendees) {
        if (connectedEmail && haveSameDomain(connectedEmail as string, attendee.email)) {
          continue;
        }
        const recordName = await nameForContact({
          nameFromService: attendee.displayName ?? '',
          emailAddress: attendee.email,
          contacts,
        });

        peopleRecordsToCreate.push({
          firstName: recordName.firstName ? recordName.firstName : '',
          lastName: recordName.lastName ? recordName.lastName : '',
          email: attendee.email,
        });
      }

      eventResponseMap[event.id] = true;
      eventsToSave.push(event);
    }

    return { eventsToSave, peopleRecordsToCreate };
  }

  createEmails = async ({ emails, options, contacts, referenceId }: CreateEmailsParams) => {
    console.log(this, this?.fetchEmails);
    const response = await this.fetchEmails({
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
      name: this.getEventKey('CONTACTS_SYNC'),
      data: {
        contacts: personRecordsToCreate,
      },
      user: {
        referenceId,
      },
    });

    await this.sendEvent({
      name: this.getEventKey('EMAIL_SYNC'),
      data: {
        emails: emailsToSave,
      },
      user: {
        referenceId,
      },
    });
  };

  createCalendarEvents = async ({
    connectedEmail,
    duration,
    options,
    person,
    referenceId,
  }: createCalendarEventsParams) => {
    const { eventsToSave, peopleRecordsToCreate } = await this.fetchCalendarEvents({
      referenceId,
      connectedEmail,
      duration,
      options,
      person,
    });

    await this.sendEvent({
      name: this.getEventKey('CONTACTS_SYNC'),
      data: {
        contacts: peopleRecordsToCreate,
      },
      user: {
        referenceId,
      },
    });

    await this.sendEvent({
      name: this.getEventKey('CALENDAR_SYNC'),
      data: {
        calendarEvents: eventsToSave,
      },
      user: {
        referenceId,
      },
    });
  };

  updateEmails = async ({ contacts, emails, referenceId }: UpdateEmailsParam) => {
    await this.sendEvent({
      name: this.getEventKey('EMAIL_SYNC'),
      data: {
        contacts,
        emails,
      },
      user: {
        referenceId,
      },
    });
  };

  updateCalendars = async ({ referenceId, entityId }: updateCalendarsParam) => {
    await this.sendEvent({
      name: this.getEventKey('GMAIL_SYNC'),
      data: {
        entityId,
      },
      user: {
        referenceId,
      },
    });
  };

  getActions() {
    return {
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
  }

  defineEvents() {
    this.events = {
      GCAL_SUBSCRIBE: {
        key: `sync.gcalSubscribe`,
        schema: z.object({
          dataIntegrationId: z.string(),
        }),
      },
      GMAIL_SUBSCRIBE: {
        key: 'sync.gmailSubscribe',
        schema: z.object({
          dataIntegrationId: z.string(),
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
          dataIntegrationId: z.string(),
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
          emails: z.record(z.any()),
        }),
      },
      CALENDAR_SYNC: {
        key: 'google.calendar/sync.table',
        schema: z.object({
          calendarEvents: z.record(z.any()),
        }),
      },
      CONTACTS_SYNC: {
        key: 'google.contacts/sync.table',
        schema: z.object({
          contacts: z.record(z.any()),
        }),
      },
    };
    return this.events;
  }

  getEventHandlers({ makeWebhookUrl }: { makeWebhookUrl: MakeWebhookURL }) {
    return [
      emailSync({
        name: this.name,
        event: this.getEventKey('EMAIL_SYNC'),
        dataLayer: this.dataLayer!,
        entityType: this.entityTypes.EMAIL,
      }),
      calendarSync({
        dataLayer: this.dataLayer!,
        event: this.getEventKey('CALENDAR_SYNC'),
        name: this.name,
        entityType: this.entityTypes.CALENDAR,
      }),
      contactSync({
        name: this.name,
        event: this.getEventKey('CONTACTS_SYNC'),
        dataLayer: this.dataLayer!,
        entityType: this.entityTypes.CONTACTS,
      }),
      gmailSubscribe({
        dataLayer: this.dataLayer!,
        makeClient: this.makeClient,
        event: this.getEventKey('GMAIL_SUBSCRIBE'),
        name: this.name,
        sendEvent: this.sendEvent,
        testIntegration: this.test,
        topic: this.config.TOPIC,
      }),
      gcalSubscribe({
        dataLayer: this.dataLayer!,
        makeClient: this.makeClient,
        event: this.getEventKey('GCAL_SUBSCRIBE'),
        makeWebhookURL: makeWebhookUrl,
        name: this.name,
        sendEvent: this.sendEvent,
        testIntegration: this.test,
      }),
      gmailSyncSyncTable({
        createEmails: this.createEmails.bind(this),
        dataLayer: this.dataLayer!,
        event: this.getEventKey('GMAIL_SYNC'),
        makeClient: this.makeClient,
        name: this.name,
      }),
      gcalSyncSyncTable({
        name: this.name,
        event: this.getEventKey('GCAL_SYNC'),
        makeClient: this.makeClient,
        createCalendarEvents: this.createCalendarEvents,
      }),
      gmailSyncUpdate({
        name: this.name,
        datalayer: this?.dataLayer!,
        event: this.getEventKey('GMAIL_UPDATE'),
        makeClient: this.makeClient,
        updateEmails: this.updateEmails,
      }),
      gCalSyncUpdate({
        name: this.name,
        dataLayer: this?.dataLayer!,
        event: this.getEventKey('GCAL_UPDATE'),
        updateCalendars: this.updateCalendars,
      }),
    ];
  }

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
          properties: createGoogleContactsFields(),
        });
      }
    }

    if (shouldSync && entity) {
      await this.sendEvent({
        name: this.getEventKey('GMAIL_SYNC'),
        data: {
          entityId: entity.id,
        },
        user: {
          referenceId,
        },
      });

      const gcalEvent = await this.sendEvent({
        name: this.getEventKey('GCAL_SYNC'),
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

  async query({ referenceId, entityType }: { referenceId: string; entityType: GoogleEntityTypes }): Promise<any> {
    const connection = await this.dataLayer?.getConnectionByReferenceId({ referenceId, name: this.name });

    if (!connection) {
      throw new Error('No connection found');
    }

    const recordData = await this.dataLayer?.getRecords({
      connectionId: connection.id,
      entityType,
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
    if (event === 'GMAIL_UPDATE') {
      const message = reqBody.message;
      const emailAddress = message.emailAddress;
      const historyId = message.historyId;

      const connections = await connectionsBySubscriptionId(emailAddress);

      connections.forEach(async connection => {
        this.sendEvent({
          name: this.getEventKey(event),
          data: {
            emailAddress,
            historyId,
          },
          user: {
            referenceId: connection?.referenceId,
          },
        });
      });
    } else if (event === 'GCAL_UPDATE') {
      const headersList = nextHeaders();
      const subscriptionId = headersList.get('X-Goog-Resource-Id');

      if (!subscriptionId) {
        throw new Error('No X-Goog-Channel-Id found in headers');
      }

      const connections = await connectionsBySubscriptionId(subscriptionId);

      connections?.forEach(async connection => {
        this.sendEvent({
          name: this.getEventKey(event),
          data: {
            connectionId: connection?.id,
          },
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
        name: this.getEventKey('GMAIL_SUBSCRIBE'),
        data: {
          connectionId: connection.id,
        },
        user: {
          referenceId: connection.referenceId,
        },
      });
    }

    await this.sendEvent({
      name: this.getEventKey('GCAL_SUBSCRIBE'),
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

    await client.stopCalendarChannel();

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
