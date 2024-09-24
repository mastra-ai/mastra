import { EventHandler } from '@kpl/core';
import retry from 'async-retry-ng';
import { gmail_v1 } from 'googleapis';
import { Address as PostalMimeAddress } from 'postal-mime';

import { EmptyGmailHistory, GmailMessageNotFound } from '../errors';
import { getValidRecipientAddresses, isEmailValidForSync, isSentEmail, nameForContact } from '../helpers';
import { GoogleConnection } from '../types';

import { GoogleIntegration } from '..';

export const gmailSyncUpdate: EventHandler<GoogleIntegration> = ({
  integrationInstance: { makeClient, dataLayer, name, updateEmails },
  eventKey,
}) => ({
  id: `${name}-sync-gmail-update`,
  event: eventKey,
  executor: async ({ event, step }) => {
    const { historyId } = event.data as { emailAddress: string; historyId: string };
    const { connectionId } = event.user;

    const client = await makeClient({ connectionId });

    const connection = await dataLayer?.getConnection({
      connectionId,
      name,
    });

    if (!connection) {
      throw new Error('No Data Integration found during gmail update');
    }

    try {
      const connectedEmail = (await client.getTokenInfo())?.email;
      if (!connectedEmail) throw new Error('No connected email');

      const gmailHistory: gmail_v1.Schema$History[] = [];
      let pageToken: string | undefined = undefined;

      await retry(
        async () => {
          await client.getGmailHistory({ historyId, histories: gmailHistory, pageToken });

          if (!gmailHistory || !gmailHistory.length) {
            throw new EmptyGmailHistory('No history to process');
          }
        },
        { retries: 5 },
      );

      const recordSearchCache: Record<string, true> = {};
      const messages = await client.aggregateMessagesFromHistory({ gmailHistory });
      let contacts: Record<string, GoogleConnection> = {};

      try {
        contacts = await client.findGoogleContactsHavingEmailAddress();
      } catch (error) {
        /* fail silently */
      }

      const personRecordsToCreate: Record<string, any>[] = [];
      const emailsOfRecordsToCreate = new Set<string>();

      for (const email of messages) {
        if (!email || !email.to) continue;

        let recipients: PostalMimeAddress[] = isSentEmail(email) ? email.to : [email.from];

        // filter recipients to remove service email addresses
        recipients = getValidRecipientAddresses({ addresses: recipients, connectedEmail });
        if (recipients?.length < 1) continue;

        // check if the inreply to exists in the db, if not remove the inReplyTo field
        if (email.inReplyTo) {
          console.info(`Checking if 'inReplyTo' reference exists in DB. 'inReplyTo' ref: ${email.inReplyTo}`);
          const existingInReplyTo = await dataLayer?.getRecordByPropertyNameAndValue({
            propertyName: 'messageId',
            propertyValue: email.inReplyTo,
            connectionId,
            type: 'EMAIL',
          });

          if (!existingInReplyTo) {
            console.info(`No 'inReplyTo' ${email.inReplyTo} in DB. Deleting 'inReplyTo' ref`);

            delete email.inReplyTo;
          }
        }

        if (!isEmailValidForSync({ email: email.from?.address || '', connectedEmail })) continue;

        for (const recipient of recipients) {
          if (!recipient.address || recipient.address == connectedEmail) {
            continue;
          }
          let isRecordExistingInCache = recordSearchCache[recipient.address];

          if (isRecordExistingInCache) continue;

          if (!recipient.address) continue;

          const existingRecord = await dataLayer?.getRecordByPropertyNameAndValue({
            propertyName: 'email',
            propertyValue: recipient.address,
            connectionId,
            type: 'CONTACTS',
          });

          // Update search cache
          if (existingRecord) {
            recordSearchCache[recipient.address] = true;
            continue;
          }

          if (emailsOfRecordsToCreate.has(recipient.address)) continue;

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

          emailsOfRecordsToCreate.add(recipient.address);
        }
      }

      await updateEmails({
        connectionId,
        contacts,
        emails: messages,
      });
    } catch (err) {
      if (err instanceof EmptyGmailHistory || err instanceof GmailMessageNotFound) {
        console.warn(err.message);
        return;
      }
    }

    return { event, body: `sync completed` };
  },
});

export const gCalSyncUpdate: EventHandler<GoogleIntegration> = ({
  integrationInstance: { name, updateCalendars },
  eventKey,
}) => ({
  id: `${name}-sync-gcal-update`,
  event: eventKey,
  executor: async ({ event, step }) => {
    const { connectionId } = event?.user;

    await step.run('init-gcal-data-sync', async () => {
      await updateCalendars({
        connectionId,
      });
    });

    return { event, body: `sync completed` };
  },
});
