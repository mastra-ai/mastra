import { EventHandler } from '@arkw/core';

import { API_V2010_ACCOUNT_CALLFields } from '../constants';

import { TwilioIntegration } from '..';

export const ListCall: EventHandler<TwilioIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient, config },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-API_V2010_ACCOUNT_CALL-ListCall`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { referenceId } = event.user;
    const { To, From, ParentCallSid, Status, StartTime, EndTime, PageSize, Page, PageToken, AccountSid } = event.data;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Calls.json'].get({
      params: { AccountSid },
      query: { To, From, ParentCallSid, Status, StartTime, EndTime, PageSize, Page, PageToken },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching ListCall', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    const records = d?.['calls']?.map(r => {
      return {
        externalId: r.sid,
        data: r,
        entityType: 'API_V2010_ACCOUNT_CALL',
      };
    });

    if (records && records?.length > 0) {
      await dataLayer?.syncData({
        name,
        referenceId,
        data: records,
        type: `API_V2010_ACCOUNT_CALL`,
        properties: API_V2010_ACCOUNT_CALLFields,
      });
    }
  },
});
