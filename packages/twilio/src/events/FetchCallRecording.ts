
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_CALL_CALL_RECORDINGFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchCallRecording: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_CALL_CALL_RECORDING-FetchCallRecording`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, CallSid, Sid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Recordings/{Sid}.json'].get({
            params: { AccountSid, CallSid, Sid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchCallRecording", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = [d].map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_CALL_CALL_RECORDINGFields,
            } 
          })

          await dataLayer?.syncData({
              name,
              referenceId,
              data: records,
              type: `API_V2010_ACCOUNT_CALL_CALL_RECORDING`,
              properties: API_V2010_ACCOUNT_CALL_CALL_RECORDINGFields,
          });          
        }
    });
  