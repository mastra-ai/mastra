import { EventHandler } from '@arkw/core';

import { API_V2010_ACCOUNT_CALLFields } from '../constants';

import { TwilioIntegration } from '..';

export const FetchCall: EventHandler<TwilioIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient, config },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-API_V2010_ACCOUNT_CALL-FetchCall`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { referenceId } = event.user;
    const { AccountSid, Sid } = event.data;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Calls/{Sid}.json'].get({
      params: { AccountSid, Sid },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching FetchCall', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    const records = [d]?.map(r => {
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
