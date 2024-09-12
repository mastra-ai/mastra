import { EventHandler, OAuthToken } from '@kpl/core';
import { lists } from '@mailchimp/mailchimp_marketing';

import { MAILCHIMP_FIELDS, mapMailchimpMemberToPersonRecord } from '../constants';
import { isMailchimpErrorResponse, MailchimpClientConfig } from '../types';

import { MailchimpIntegration } from '..';

const BATCH_SIZE = 10;

const loadMailchimpList = async ({ accessToken, server }: MailchimpClientConfig) => {
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
  const membersResponse = await lists.getListMembersInfo(listId, {
    count: BATCH_SIZE,
    offset: (page - 1) * BATCH_SIZE,
  });

  console.log(membersResponse);

  if (isMailchimpErrorResponse(membersResponse)) {
    throw new Error(`${membersResponse.type}: ${membersResponse.title} - ${membersResponse.detail}`);
  }

  return membersResponse.members.map(mapMailchimpMemberToPersonRecord);
};

export const mailchimpSync: EventHandler<MailchimpIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-contacts`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { entityType } = event.data;
    const { referenceId } = event.user;

    const connection = await dataLayer?.getConnectionByReferenceId({ referenceId, name });

    if (!connection) {
      throw new Error('Integration connection not found');
    }

    // Mailchimp accessTokens never expire, so it is safe to use the token in a memoized context
    const context = await step.run('load-context', async () => {
      let syncTable;

      try {
        syncTable = await dataLayer?.getEntityByConnectionAndType({
          connectionId: connection.id,
          type: entityType,
        });
      } catch (e) {
        console.error(e);
      }

      if (!syncTable && connection) {
        syncTable = await dataLayer?.createEntity({
          connectionId: connection?.id,
          referenceId,
          type: entityType,
        });
      }

      const credential = await dataLayer?.getCredentialsByConnectionId(connection.id);
      const token = credential?.value as OAuthToken;

      return {
        syncTable,
        accessToken: token.accessToken,
        server: token.serverPrefix,
      };
    });

    const { accessToken, server } = context;

    const mailchimp = require('@mailchimp/mailchimp_marketing');

    mailchimp.setConfig({
      accessToken,
      server,
    });

    console.log(mailchimp.config);

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
          externalId: _externalId,
          data: person,
          entityType,
        }));

        await dataLayer?.syncData({
          name,
          referenceId,
          data: records,
          type: entityType,
          properties: MAILCHIMP_FIELDS,
          lastSyncId: event?.id!,
        });
      });
    }
  },
});
