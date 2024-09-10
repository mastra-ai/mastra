import { EventHandler } from '@arkw/core';

import { API_V2010_ACCOUNT_USAGE_USAGE_TRIGGERFields } from '../constants';

import { TwilioIntegration } from '..';

export const ListUsageTrigger: EventHandler<TwilioIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient, config },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-API_V2010_ACCOUNT_USAGE_USAGE_TRIGGER-ListUsageTrigger`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { referenceId } = event.user;
    const { Recurring, TriggerBy, UsageCategory, PageSize, Page, PageToken, AccountSid } = event.data;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Usage/Triggers.json'].get({
      params: { AccountSid },
      query: { Recurring, TriggerBy, UsageCategory, PageSize, Page, PageToken },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching ListUsageTrigger', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    const records = d?.['usage_triggers']?.map(r => {
      return {
        externalId: r.sid,
        data: r,
        entityType: 'API_V2010_ACCOUNT_USAGE_USAGE_TRIGGER',
      };
    });

    if (records && records?.length > 0) {
      await dataLayer?.syncData({
        name,
        referenceId,
        data: records,
        type: `API_V2010_ACCOUNT_USAGE_USAGE_TRIGGER`,
        properties: API_V2010_ACCOUNT_USAGE_USAGE_TRIGGERFields,
      });
    }
  },
});
