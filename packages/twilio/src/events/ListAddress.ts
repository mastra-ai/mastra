
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_ADDRESSFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListAddress: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient, config },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_ADDRESS-ListAddress`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { CustomerName, FriendlyName, IsoCountry, PageSize, Page, PageToken, AccountSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Addresses.json'].get({
            params: { AccountSid },
            query: { CustomerName, FriendlyName, IsoCountry, PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListAddress", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d?.['addresses']?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_ADDRESSFields,
            } 
          })

          if (records && records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_ADDRESS`,
                properties: API_V2010_ACCOUNT_ADDRESSFields,
            });             
          }
        }
    });
  