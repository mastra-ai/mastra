
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_TOLL_FREEFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListIncomingPhoneNumberTollFree: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_TOLL_FREE-ListIncomingPhoneNumberTollFree`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { Beta, FriendlyName, PhoneNumber, Origin, PageSize, Page, PageToken, AccountSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/TollFree.json'].get({
            params: { AccountSid },
            query: { Beta, FriendlyName, PhoneNumber, Origin, PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListIncomingPhoneNumberTollFree", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d?.['incoming_phone_numbers']?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_TOLL_FREEFields,
            } 
          })

          if (records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_TOLL_FREE`,
                properties: API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_TOLL_FREEFields,
            });             
          }
        }
    });
  