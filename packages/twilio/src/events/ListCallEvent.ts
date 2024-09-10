import { EventHandler } from '@arkw/core';

import { API_V2010_ACCOUNT_CALL_CALL_EVENTFields } from '../constants';

import { TwilioIntegration } from '..';

export const ListCallEvent: EventHandler<TwilioIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient, config },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-API_V2010_ACCOUNT_CALL_CALL_EVENT-ListCallEvent`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { referenceId } = event.user;
    const { PageSize, Page, PageToken, AccountSid, CallSid } = event.data;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Events.json'].get({
      params: { AccountSid, CallSid },
      query: { PageSize, Page, PageToken },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching ListCallEvent', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    const records = d?.['events']?.map(r => {
      return {
        externalId: config['ACCOUNT_SID'],
        data: r,
        entityType: 'API_V2010_ACCOUNT_CALL_CALL_EVENT',
      };
    });

    if (records && records?.length > 0) {
      await dataLayer?.syncData({
        name,
        referenceId,
        data: records,
        type: `API_V2010_ACCOUNT_CALL_CALL_EVENT`,
        properties: API_V2010_ACCOUNT_CALL_CALL_EVENTFields,
      });
    }
  },
});
