import { EventHandler } from '@arkw/core';

import { API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRYFields } from '../constants';

import { TwilioIntegration } from '..';

export const ListAvailablePhoneNumberCountry: EventHandler<TwilioIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient, config },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY-ListAvailablePhoneNumberCountry`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { referenceId } = event.user;
    const { PageSize, Page, PageToken, AccountSid } = event.data;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy['/2010-04-01/Accounts/{AccountSid}/AvailablePhoneNumbers.json'].get({
      params: { AccountSid },
      query: { PageSize, Page, PageToken },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching ListAvailablePhoneNumberCountry', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    const records = d?.['countries']?.map(r => {
      return {
        externalId: config['ACCOUNT_SID'],
        data: r,
        entityType: 'API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY',
      };
    });

    if (records && records?.length > 0) {
      await dataLayer?.syncData({
        name,
        referenceId,
        data: records,
        type: `API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY`,
        properties: API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRYFields,
      });
    }
  },
});
