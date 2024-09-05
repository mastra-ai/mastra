
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_ADDRESSFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchAddress: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_ADDRESS-FetchAddress`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, Sid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Addresses/{Sid}.json'].get({
            params: { AccountSid, Sid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchAddress", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = [d]?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_ADDRESSFields,
            } 
          })

          if (records?.length > 0) {
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
  