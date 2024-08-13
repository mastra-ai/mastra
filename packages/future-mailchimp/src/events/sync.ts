import { setConfig, lists } from '@mailchimp/mailchimp_marketing';
import { DataLayer, OAuthToken } from 'core';

import { mapMailchimpMemberToPersonRecord } from '../constants';
import { isMailchimpErrorResponse, MailchimpClientConfig } from '../types';

const BATCH_SIZE = 10;

const loadContext = async ({ syncTableId, dataLayer }: { syncTableId: string; dataLayer: DataLayer }) => {
  const syncTable = await dataLayer.getSyncTableById(syncTableId);

  if (!syncTable) {
    throw new Error('Sync Table not found');
  }

  const connection = await dataLayer.getConnectionById({
    connectionId: syncTable.dataIntegrationId,
    name: 'MAILCHIMP',
  });

  if (!connection) {
    throw new Error('Connection not found');
  }

  const credential = await dataLayer.getConnectionCredentialsById(connection.id);
  const token = credential.value as OAuthToken;

  return {
    syncTable,
    connection,
    accessToken: token.accessToken,
    server: token.serverPrefix,
  };
};

const loadMailchimpList = async ({ accessToken, server }: MailchimpClientConfig) => {
  setConfig({
    accessToken,
    server,
  });

  const listsResponse = await lists.getAllLists({
    includeTotalContacts: true,
  });

  if (isMailchimpErrorResponse(listsResponse)) {
    throw new Error(`${listsResponse.type}: ${listsResponse.title} - ${listsResponse.detail}`);
  }

  // TODO: Eventually support pulling from multiple lists
  const { id, stats } = listsResponse.lists.at(0) as lists.List;

  return {
    listId: id,
    pages: Math.ceil(stats.total_contacts / BATCH_SIZE),
  };
};

const getMailchimpMembersAsRecord = async ({
  accessToken,
  server,
  listId,
  page,
}: MailchimpClientConfig & { listId: string; page: number }) => {
  setConfig({
    accessToken,
    server,
  });

  const membersResponse = await lists.getListMembersInfo(listId, {
    count: BATCH_SIZE,
    offset: (page - 1) * BATCH_SIZE,
  });

  if (isMailchimpErrorResponse(membersResponse)) {
    throw new Error(`${membersResponse.type}: ${membersResponse.title} - ${membersResponse.detail}`);
  }

  return membersResponse.members.map(mapMailchimpMemberToPersonRecord);
};

export const mailchimpSync = ({ name, event, dataLayer }: { event: string; name: string; dataLayer: DataLayer }) => ({
  id: `${name}-gmail-sync-worksheet`,
  event,
  executor: async ({ event, step }: any) => {
    const { syncTableId } = event.data;

    // Mailchimp accessTokens never expire, so it is safe to use the token in a memoized context
    const context = await step.run('load-context', async () => loadContext({ syncTableId, dataLayer }));
    const { accessToken, server, worksheet, connection } = context;

    const { listId, pages } = await step.run('load-mailchimp-list-info', async () =>
      loadMailchimpList({ accessToken, server }),
    );

    for (let page = 1; page <= pages; page++) {
      await step.run(`sync-mailchimp-list-members-page-${page}`, async () => {
        const people = await getMailchimpMembersAsRecord({
          accessToken,
          server,
          listId,
          page,
        });

        const records = people.map(({ _externalId, ...person }) => ({
          workspaceId: worksheet.workspaceId,
          ownerId: connection.workspaceUser.userId,
          createdBy: connection.workspaceUser.userId,
          recordTypeId: worksheet.recordTypeId,
          externalId: _externalId,
          data: person,
        }));

        await dataLayer.mergeExternalRecordsForSyncTable({
          syncTableId,
          records,
        });
      });
    }
  },
});
