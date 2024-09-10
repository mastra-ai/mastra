import { EventHandler } from '@arkw/core';

import { API_V2010_ACCOUNT_BALANCEFields } from '../constants';

import { TwilioIntegration } from '..';

export const FetchBalance: EventHandler<TwilioIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient, config },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-API_V2010_ACCOUNT_BALANCE-FetchBalance`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { referenceId } = event.user;
    const { AccountSid } = event.data;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Balance.json'].get({
      params: { AccountSid },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching FetchBalance', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    const records = [d]?.map(r => {
      return {
        externalId: r.account_sid,
        data: r,
        entityType: 'API_V2010_ACCOUNT_BALANCE',
      };
    });

    if (records && records?.length > 0) {
      await dataLayer?.syncData({
        name,
        referenceId,
        data: records,
        type: `API_V2010_ACCOUNT_BALANCE`,
        properties: API_V2010_ACCOUNT_BALANCEFields,
      });
    }
  },
});
