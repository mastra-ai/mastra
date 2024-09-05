
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNTFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListAccount: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT-ListAccount`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { FriendlyName, Status, PageSize, Page, PageToken } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts.json'].get({
            
            query: { FriendlyName, Status, PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListAccount", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d?.['accounts']?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNTFields,
            } 
          })

          if (records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT`,
                properties: API_V2010_ACCOUNTFields,
            });             
          }
        }
    });
  