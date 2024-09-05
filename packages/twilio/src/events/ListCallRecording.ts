
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_CALL_CALL_RECORDINGFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListCallRecording: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient, config },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_CALL_CALL_RECORDING-ListCallRecording`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { DateCreated, DateCreated<, DateCreated>, PageSize, Page, PageToken, AccountSid, CallSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Recordings.json'].get({
            params: { AccountSid, CallSid },
            query: { DateCreated, DateCreated<, DateCreated>, PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListCallRecording", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d?.['recordings']?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_CALL_CALL_RECORDINGFields,
            } 
          })

          if (records && records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_CALL_CALL_RECORDING`,
                properties: API_V2010_ACCOUNT_CALL_CALL_RECORDINGFields,
            });             
          }
        }
    });
  