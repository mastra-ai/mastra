
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNTFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchAccount: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT-FetchAccount`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { Sid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{Sid}.json'].get({
            params: { Sid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchAccount", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = [d].map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNTFields,
            } 
          })

          await dataLayer?.syncData({
              name,
              referenceId,
              data: records,
              type: `API_V2010_ACCOUNT`,
              properties: API_V2010_ACCOUNTFields,
          });          
        }
    });
  