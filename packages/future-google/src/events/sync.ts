import { DataLayer, EventHandler } from 'core';

import { GoogleClient } from '../client';
import { Labels } from '../constants';
import {
  arrangeThreadMessagesByFirstMessageData,
  createGoogleCalendarFields,
  createGoogleMailFields,
} from '../helpers';
import { Connection, CreateEmailsParams, Email, MakeClient } from '../types';

export const emailSync = ({
  name,
  event,
  dataLayer,
}: {
  event: string;
  dataLayer: DataLayer;
  name: string;
}): EventHandler => ({
  id: `${name}-sync-email`,
  event,
  executor: async ({ event, step }) => {
    const { contacts, emails } = event.data;
    const { connectionId } = event.user;

    const dataInt = await dataLayer?.getDataIntegrationByConnectionId({ connectionId, name });

    let existingSyncTable = await dataLayer?.getSyncTableByDataIdAndType({
      dataIntegrationId: dataInt?.id!,
      type: `EMAIL`,
    });

    if (!existingSyncTable) {
      existingSyncTable = await dataLayer?.createSyncTable({
        dataIntegrationId: dataInt?.id!,
        type: `EMAIL`,
        connectionId,
      });

      await dataLayer?.addFieldsToSyncTable({
        syncTableId: existingSyncTable?.id!,
        fields: createGoogleMailFields(),
      });
    } else {
      const contactsTable = await dataLayer?.getSyncTableByDataIdAndType({
        dataIntegrationId: dataInt?.id!,
        type: `CONTACTS`,
      });

      if (contactsTable) {
        await dataLayer?.mergeExternalRecordsForSyncTable({
          syncTableId: contactsTable.id,
          records: contacts?.map((r: any) => {
            return {
              externalId: r.email,
              data: r,
            };
          }),
        });
      }
    }

    await dataLayer.mergeExternalRecordsForSyncTable({
      syncTableId: existingSyncTable?.id!,
      records: emails.map((r: any) => {
        return {
          externalId: r.messageId,
          data: r,
        };
      }),
    });
  },
});

export const calendarSync = ({
  name,
  event,
  dataLayer,
}: {
  event: string;
  dataLayer: DataLayer;
  name: string;
}): EventHandler => ({
  id: `${name}-sync-email`,
  event,
  executor: async ({ event, step }) => {
    const { contacts, calendarEvents } = event.data;
    const { connectionId } = event.user;

    const dataInt = await dataLayer?.getDataIntegrationByConnectionId({ connectionId, name });

    let existingSyncTable = await dataLayer?.getSyncTableByDataIdAndType({
      dataIntegrationId: dataInt?.id!,
      type: `CALENDAR`,
    });

    if (!existingSyncTable) {
      existingSyncTable = await dataLayer?.createSyncTable({
        dataIntegrationId: dataInt?.id!,
        type: `CALENDAR`,
        connectionId,
      });

      await dataLayer?.addFieldsToSyncTable({
        syncTableId: existingSyncTable?.id!,
        fields: createGoogleCalendarFields(),
      });
    } else {
      const contactsTable = await dataLayer?.getSyncTableByDataIdAndType({
        dataIntegrationId: dataInt?.id!,
        type: `CONTACTS`,
      });
      if (contactsTable) {
        await dataLayer?.mergeExternalRecordsForSyncTable({
          syncTableId: contactsTable.id,
          records: contacts?.map((r: any) => {
            return {
              externalId: r.email,
              data: r,
            };
          }),
        });
      }
    }

    await dataLayer.mergeExternalRecordsForSyncTable({
      syncTableId: existingSyncTable?.id!,
      records: calendarEvents.map((r: any) => {
        return {
          externalId: r.messageId,
          data: r,
        };
      }),
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
  id: `${name}-gmail-sync-worksheet`,
  event,
  executor: async ({ event, step }: any) => {
    const { syncTableId, options } = event.data;
    const { connectionId } = event.user;
    const client = await makeClient({ connectionId });

    const duration = options?.duration;
    const dataIntegration = await dataLayer.getDataIntegrationByConnectionId(connectionId);

    // load context for this worksheet
    const { connectedEmail, startSyncFrom } = await step.run('load-gmail-sync-context', async () => {
      if (!dataIntegration) throw new Error('Data Integration not found');

      let startSyncFrom = dataIntegration?.lastSyncAt ? new Date(dataIntegration.lastSyncAt) : undefined;

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

      let contacts: Record<string, Connection> = {};
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
            syncTableId,
            recordSearchCache,
          },
          contacts,
          connectionId,
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
            syncTableId,
            recordSearchCache,
          },
          contacts,
          connectionId,
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
      syncTableId: string;
    };
    connectedEmail?: string;
    connectionId: string;
  }) => Promise<void>;
  makeClient: MakeClient;
}) => ({
  id: `${name}-gcal-sync-worksheet`,
  event,
  executor: async ({ event, step }: any) => {
    const { syncTableId } = event.data;
    const { connectionId } = event.user;
    const client = await makeClient({ connectionId });

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
          syncTableId,
        },
        connectionId,
      });
    });

    return { event, body: `sync completed` };
  },
});
