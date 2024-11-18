import { EventHandler } from '@mastra/core';

import { CALENDAR_FIELDS, CONTACT_FIELDS, EMAIL_FIELDS, Labels } from '../constants';
import { arrangeThreadMessagesByFirstMessageData } from '../helpers';
import { GoogleConnection, Email } from '../types';

import { GoogleIntegration } from '..';

export const emailSync: EventHandler<GoogleIntegration> = ({ integrationInstance: { name, dataLayer }, eventKey }) => ({
  id: `${name}-sync-email`,
  event: eventKey,
  executor: async ({ event }) => {
    const { emails, entityType } = event.data;
    const { connectionId } = event.user;

    await dataLayer?.syncData({
      name,
      connectionId,
      data: emails.map((r: any) => {
        return {
          externalId: r.messageId,
          data: r,
          entityType: entityType,
        };
      }),
      properties: EMAIL_FIELDS,
      type: entityType,
      lastSyncId: event?.id!,
    });
  },
});

export const calendarSync: EventHandler<GoogleIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer },
}) => ({
  id: `${name}-sync-calendar`,
  event: eventKey,
  executor: async ({ event }) => {
    const { calendarEvents, entityType } = event.data;
    const { connectionId } = event.user;

    await dataLayer?.syncData({
      name,
      connectionId,
      data: calendarEvents?.map((r: any) => {
        return {
          externalId: r.id,
          data: r,
          entityType: entityType,
        };
      }),
      properties: CALENDAR_FIELDS,
      type: entityType,
      lastSyncId: event?.id!,
    });
  },
});

export const contactSync: EventHandler<GoogleIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer },
}) => ({
  id: `${name}-sync-contacts`,
  event: eventKey,
  executor: async ({ event }) => {
    const { contacts, entityType } = event.data;
    const { connectionId } = event.user;

    await dataLayer?.syncData({
      name,
      connectionId,
      data: contacts?.map((r: any) => {
        return {
          externalId: r.email,
          data: r,
          entityType: entityType,
        };
      }),
      properties: CONTACT_FIELDS,
      type: entityType,
      lastSyncId: event?.id!,
    });
  },
});

export const gmailSyncSyncTable: EventHandler<GoogleIntegration> = ({
  integrationInstance: { name, makeClient, dataLayer, createEmails },
  eventKey,
}) => ({
  id: `${name}-gmail-sync-table`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { options } = event.data;
    const { connectionId } = event.user;

    const client = await makeClient({ connectionId });

    const duration = options?.duration;
    const connection = await dataLayer?.getConnection({ connectionId, name });

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
          emails: messages,
          options: {
            connectedEmail,
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

export const gcalSyncSyncTable: EventHandler<GoogleIntegration> = ({
  integrationInstance: { name, makeClient, createCalendarEvents },
  eventKey,
}) => ({
  id: `${name}-gcal-sync-table`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { connectionId } = event.user;
    const { options } = event.data;
    const client = await makeClient({ connectionId });

    const { connectedEmail } = await step.run('load-gcal-sync-context', async () => {
      const { email } = await client.getTokenInfo();
      return {
        connectedEmail: email,
      };
    });

    await step.run('run-gcal-data-sync', async () => {
      await createCalendarEvents({
        connectedEmail,
        connectionId,
        duration: options?.duration,
      });
    });

    return { event, body: `sync completed` };
  },
});
