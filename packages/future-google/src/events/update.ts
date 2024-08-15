// import { gmail_v1 } from '@googleapis/gmail';
// import retry from 'async-retry-ng';
// import { DataLayer, EventHandler } from 'core';

// import { EmptyGmailHistory, GmailMessageNotFound } from '../errors';
// import { Connection, MakeClient } from '../types';

// export const gmailSyncUpdate = ({
//   name,
//   event,
//   makeClient,
//   datalayer,
// }: {
//   name: string;
//   event: string;
//   makeClient: MakeClient;
//   datalayer: DataLayer;
// }): EventHandler => ({
//   id: `${name}-sync-gmail-update`,
//   event,
//   executor: async ({ event, step }) => {
//     const { emailAddress, historyId } = event.data as { emailAddress: string; historyId: string };
//     const { connectionId } = event.user;

//     const client = await makeClient({ connectionId });

//     try {
//       const connectedEmail = (await client.getTokenInfo())?.email;
//       if (!connectedEmail) throw new Error('No connected email');

//       const gmailHistory: gmail_v1.Schema$History[] = [];
//       let pageToken: string | undefined = undefined;

//       await retry(
//         async () => {
//           await client.getGmailHistory({ historyId, histories: gmailHistory, pageToken });

//           if (!gmailHistory || !gmailHistory.length) {
//             throw new EmptyGmailHistory('No history to process');
//           }
//         },
//         { retries: 5 },
//       );

//       const worksheet = await createWorksheet({ api, shouldSync: false });
//       const recordSearchCache: Record<string, true> = {};
//       const messages = await client.aggregateMessagesFromHistory({ gmailHistory });
//       let contacts: Record<string, Connection> = {};

//       try {
//         contacts = await client.findGoogleContactsHavingEmailAddress();
//       } catch (error) {
//         /* fail silently */
//       }

//       const { personRecordsToCreate } = await api.processAndSaveEmails({
//         messages,
//         recordSearchCache,
//         connectedEmail,
//         peopleRecordTypeId: worksheet.recordTypeId,
//         contacts,
//       });

//       // create records for new email addresses found during update
//       await api.bulkCreateRecordsForWorksheet({
//         data: personRecordsToCreate,
//         uniqueIdentifier: 'email',
//         worksheetId: worksheet.id,
//         recordTypeId: worksheet.recordTypeId,
//       });
//     } catch (err) {
//       if (err instanceof EmptyGmailHistory || err instanceof GmailMessageNotFound) {
//         console.warn(err.message);
//         return;
//       }
//     }

//     return { event, body: `sync completed` };
//   },
// });

// export const gCalSyncUpdate = ({
//   name,
//   event,
//   createWorksheet,
// }: {
//   name: string;
//   event: string;
//   createWorksheet: ({ api, shouldSync }: { api: IntegrationAPI; shouldSync: boolean }) => Promise<Worksheet>;
// }) => ({
//   id: `${name}-sync-gcal-update`,
//   event,
//   executor: async ({ event, step }: BaseContext<any>) => {
//     // TODO: Used to sync calendar events for created person record
//     // maybe we should break up this event handler
//     const person = event.data.person;
//     const { userId, workspaceId } = event?.user;

//     const api = makeAPI({ context: { workspaceId, userId } });

//     await step.run('init-gcal-data-sync', async () => {
//       await createWorksheet({ api, shouldSync: true });
//     });

//     return { event, body: `sync completed` };
//   },
// });
