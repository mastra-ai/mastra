import { EventHandler } from '@arkw/core';

import { API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_TOLL_FREEFields } from '../constants';

import { TwilioIntegration } from '..';

export const ListAvailablePhoneNumberTollFree: EventHandler<TwilioIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient, config },
  makeWebhookUrl,
}) => ({
  id: `${name}-sync-API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_TOLL_FREE-ListAvailablePhoneNumberTollFree`,
  event: eventKey,
  executor: async ({ event, step }: any) => {
    const { referenceId } = event.user;
    const {
      AreaCode,
      Contains,
      SmsEnabled,
      MmsEnabled,
      VoiceEnabled,
      ExcludeAllAddressRequired,
      ExcludeLocalAddressRequired,
      ExcludeForeignAddressRequired,
      Beta,
      NearNumber,
      NearLatLong,
      Distance,
      InPostalCode,
      InRegion,
      InRateCenter,
      InLata,
      InLocality,
      FaxEnabled,
      PageSize,
      Page,
      PageToken,
      AccountSid,
      CountryCode,
    } = event.data;
    const proxy = await getApiClient({ referenceId });

    // @ts-ignore
    const response = await proxy[
      '/2010-04-01/Accounts/{AccountSid}/AvailablePhoneNumbers/{CountryCode}/TollFree.json'
    ].get({
      params: { AccountSid, CountryCode },
      query: {
        AreaCode,
        Contains,
        SmsEnabled,
        MmsEnabled,
        VoiceEnabled,
        ExcludeAllAddressRequired,
        ExcludeLocalAddressRequired,
        ExcludeForeignAddressRequired,
        Beta,
        NearNumber,
        NearLatLong,
        Distance,
        InPostalCode,
        InRegion,
        InRateCenter,
        InLata,
        InLocality,
        FaxEnabled,
        PageSize,
        Page,
        PageToken,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('error in fetching ListAvailablePhoneNumberTollFree', JSON.stringify(error, null, 2));
      return;
    }

    const d = await response.json();

    const records = d?.['available_phone_numbers']?.map(r => {
      return {
        externalId: config['ACCOUNT_SID'],
        data: r,
        entityType: 'API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_TOLL_FREE',
      };
    });

    if (records && records?.length > 0) {
      await dataLayer?.syncData({
        name,
        referenceId,
        data: records,
        type: `API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_TOLL_FREE`,
        properties: API_V2010_ACCOUNT_AVAILABLE_PHONE_NUMBER_COUNTRY_AVAILABLE_PHONE_NUMBER_TOLL_FREEFields,
      });
    }
  },
});
