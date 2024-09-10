import { EventHandler } from '@arkw/core';

import { API_V2010_ACCOUNT_CONFERENCEFields } from '../constants';

import { TwilioIntegration } from '..';

export const ListConference: EventHandler<TwilioIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient, config },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-API_V2010_ACCOUNT_CONFERENCE-ListConference`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { referenceId } = event.user;
    const { DateCreated, DateUpdated, FriendlyName, Status, PageSize, Page, PageToken, AccountSid } = event.data;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Conferences.json'].get({
      params: { AccountSid },
      query: { DateCreated, DateUpdated, FriendlyName, Status, PageSize, Page, PageToken },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching ListConference', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    const records = d?.['conferences']?.map(r => {
      return {
        externalId: r.sid,
        data: r,
        entityType: 'API_V2010_ACCOUNT_CONFERENCE',
      };
    });

    if (records && records?.length > 0) {
      await dataLayer?.syncData({
        name,
        referenceId,
        data: records,
        type: `API_V2010_ACCOUNT_CONFERENCE`,
        properties: API_V2010_ACCOUNT_CONFERENCEFields,
      });
    }
  },
});
