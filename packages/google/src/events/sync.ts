import { DataLayer, EventHandler } from '@arkw/core';

import { GoogleClient } from '../client';
import { Labels } from '../constants';
import {
  arrangeThreadMessagesByFirstMessageData,
  createGoogleCalendarFields,
  createGoogleMailFields,
  createGoogleContactsFields,
} from '../helpers';
import { GoogleConnection, CreateEmailsParams, Email, MakeClient } from '../types';

export const emailSync = ({
  name,
  event,
  dataLayer,
  eventType,
}: {
  event: string;
  dataLayer: DataLayer;
  name: string;
  eventType: string;
}): EventHandler => ({
  id: `${name}-sync-email`,
  event,
  executor: async ({ event }) => {
    const { emails } = event.data;
    const { referenceId } = event.user;

    await dataLayer?.syncData({
      name,
      referenceId,
      data: emails.map((r: any) => {
        return {
          externalId: r.messageId,
          data: r,
          recordType: eventType,
        };
      }),
      properties: createGoogleMailFields(),
      type: eventType,
    });
  },
});

export const calendarSync = ({
  name,
  event,
  dataLayer,
  eventType,
}: {
  event: string;
  dataLayer: DataLayer;
  name: string;
  eventType: string;
}): EventHandler => ({
  id: `${name}-sync-calendar`,
  event,
  executor: async ({ event }) => {
    const { calendarEvents } = event.data;
    const { referenceId } = event.user;

    await dataLayer?.syncData({
      name,
      referenceId,
      data: calendarEvents?.map((r: any) => {
        return {
          externalId: r.id,
          data: r,
          recordType: eventType,
        };
      }),
      properties: createGoogleCalendarFields(),
      type: eventType,
    });
  },
});

export const contactSync = ({
  name,
  event,
  dataLayer,
  eventType,
}: {
  event: string;
  dataLayer: DataLayer;
  name: string;
  eventType: string;
}): EventHandler => ({
  id: `${name}-sync-contacts`,
  event,
  executor: async ({ event }) => {
    const { contacts } = event.data;
    const { referenceId } = event.user;

    await dataLayer?.syncData({
      name,
      referenceId,
      data: contacts?.map((r: any) => {
        return {
          externalId: r.email,
          data: r,
          recordType: eventType,
        };
      }),
      properties: createGoogleContactsFields(),
      type: eventType,
    });
  },
});

export const gmailSyncSyncTable = ({
  name,
  event,
  createEmails,
  makeClient,
  dataLayer,
}: {
  event: string;
  name: string;
  dataLayer: DataLayer;
  createEmails: (props: CreateEmailsParams) => Promise<void>;
  makeClient: MakeClient;
}): EventHandler => ({
  id: `${name}-gmail-sync-table`,
  event,
  executor: async ({ event, step }: any) => {
    const { entityId, options } = event.data;
    const { referenceId } = event.user;

    const client = await makeClient({ referenceId });

    const duration = options?.duration;
    const connection = await dataLayer.getConnectionByReferenceId({ referenceId, name });

    // load context for this worksheet
    const { connectedEmail, startSyncFrom } = await step.run('load-gmail-sync-context', async () => {
      if (!connection) throw new Error('Data Integration not found');

      let startSyncFrom = connection?.lastSyncAt ? new Date(connection.lastSyncAt) : undefined;

      if (!startSyncFrom) {
        startSyncFrom = new Date();
        startSyncFrom.setFullYear(startSyncFrom.getFullYear() - 1); // Set to a year ago by default
      }

      const { email } = await client.getTokenInfo();

      return {
        connectedEmail: email,
        startSyncFrom,
      };
    });

    await step.run('run-gmail-data-sync', async () => {
      const inboxLabels: Exclude<keyof typeof Labels, 'SENT'>[] = ['CATEGORY_PERSONAL'];
      const BATCH_SIZE = 50;
      let inboxThreadsNextPageToken = 'skip';
      let sentThreadsNextPageToken = 'skip';
      let totalEmails = 0;

      let seenThreadsCache = new Set<string>();
      const recordSearchCache = new Set<string>();

      let contacts: Record<string, GoogleConnection> = {};
      try {
        contacts = await client.findGoogleContactsHavingEmailAddress();
      } catch (error) {
        /* fail silently */
      }

      console.info('Processing inbox threads');
      while (inboxThreadsNextPageToken != '') {
        // TODO: Run these batched requests as steps.

        const { threads, pageToken } = await client.getThreads({
          pageToken: inboxThreadsNextPageToken,
          labels: inboxLabels,
          from: new Date(startSyncFrom),
          to: duration?.end,
          limit: BATCH_SIZE,
        });

        inboxThreadsNextPageToken = pageToken;

        if (!threads) break;

        /**
         * Filter out threads that have been seen and send batched request to Google API
         */
        const threadMessages = await Promise.all(
          threads
            .filter(({ id }) => !seenThreadsCache.has(id))
            .map(({ id }) => {
              seenThreadsCache.add(id);
              return client.getThreadById({ threadId: id });
            }),
        );

        // sort thread messages in order of creation to avoid collision when referencing replied threads
        const rearrangedThreadMessages = arrangeThreadMessagesByFirstMessageData(threadMessages);

        // aggregate all messages in rearranged thread messages
        const messages = rearrangedThreadMessages.reduce((acc, { messages }) => {
          acc.push(...(messages ?? []));
          return acc;
        }, [] as Email[]);

        totalEmails += messages.length;

        await createEmails({
          // messageId: '',
          emails: messages,
          options: {
            connectedEmail,
            entityId,
            recordSearchCache,
          },
          contacts,
          referenceId,
        });
      }

      console.info('Done processing inbox threads, Total emails:', totalEmails);

      console.info('Processing sent threads');
      while (sentThreadsNextPageToken != '') {
        // TODO: Run these batched requests as steps.
        const { threads, pageToken } = await client.getThreads({
          pageToken: sentThreadsNextPageToken,
          labels: ['SENT'],
          from: new Date(startSyncFrom),
          to: duration?.end,
          limit: BATCH_SIZE,
        });

        sentThreadsNextPageToken = pageToken;

        if (!threads) break;
        /**
         * Filter out threads that have been seen and send batched request to Google API
         */
        const threadMessages = await Promise.all(
          threads
            .filter(({ id }) => !seenThreadsCache.has(id))
            .map(({ id }) => {
              seenThreadsCache.add(id);
              return client.getThreadById({ threadId: id });
            }),
        );

        // sort thread messages in order of creation to avoid collision when referencing replied threads
        const rearrangedThreadMessages = arrangeThreadMessagesByFirstMessageData(threadMessages);

        // aggregate all messages in rearranged thread messages
        const messages = rearrangedThreadMessages.reduce((acc, { messages }) => {
          acc.push(...(messages ?? []));
          return acc;
        }, [] as Email[]);

        totalEmails += messages.length;

        await createEmails({
          emails: messages,
          options: {
            connectedEmail,
            entityId,
            recordSearchCache,
          },
          contacts,
          referenceId,
        });
      }

      console.log('Done processing sent threads. Total emails:', totalEmails);

      console.log('Gmail sync done');
    });

    // TODO:
    // await step.run('update-integration-lasted-synced-timestamp', async () => {
    //   await dataIntegrationService.updateDataIntegration({ id: dataIntegration.id, lastSyncAt: new Date() });
    // });
  },
});

export const gcalSyncSyncTable = ({
  name,
  event,
  createCalendarEvents,
  makeClient,
}: {
  event: string;
  name: string;
  createCalendarEvents: (props: {
    client?: GoogleClient;
    person?: { email: string; recordId: string };
    duration?: { minDate: Date; maxDate: Date };
    options?: {
      peopleRecordTypeId: string;
      entityId: string;
    };
    connectedEmail?: string;
    referenceId: string;
  }) => Promise<void>;
  makeClient: MakeClient;
}) => ({
  id: `${name}-gcal-sync-table`,
  event,
  executor: async ({ event, step }: any) => {
    const { entityId } = event.data;
    const { referenceId } = event.user;
    const client = await makeClient({ referenceId });

    const { peopleRecordType, connectedEmail } = await step.run('load-gcal-sync-context', async () => {
      const { email } = await client.getTokenInfo();
      return {
        peopleRecordType,
        connectedEmail: email,
      };
    });

    await step.run('run-gcal-data-sync', async () => {
      await createCalendarEvents({
        client,
        connectedEmail,
        options: {
          peopleRecordTypeId: peopleRecordType?.id,
          entityId,
        },
        referenceId,
      });
    });

    return { event, body: `sync completed` };
  },
});
