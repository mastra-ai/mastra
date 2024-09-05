
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_INCOMING_PHONE_NUMBERFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchIncomingPhoneNumber: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER-FetchIncomingPhoneNumber`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, Sid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/{Sid}.json'].get({
            params: { AccountSid, Sid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchIncomingPhoneNumber", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = [d]?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_INCOMING_PHONE_NUMBERFields,
            } 
          })

          if (records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER`,
                properties: API_V2010_ACCOUNT_INCOMING_PHONE_NUMBERFields,
            });             
          }
        }
    });
  