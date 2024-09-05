
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_RECORDINGFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListRecording: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_RECORDING-ListRecording`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { DateCreated, DateCreated<, DateCreated>, CallSid, ConferenceSid, IncludeSoftDeleted, PageSize, Page, PageToken, AccountSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Recordings.json'].get({
            params: { AccountSid },
            query: { DateCreated, DateCreated<, DateCreated>, CallSid, ConferenceSid, IncludeSoftDeleted, PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListRecording", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_RECORDINGFields,
            } 
          })

          await dataLayer?.syncData({
              name,
              referenceId,
              data: records,
              type: `API_V2010_ACCOUNT_RECORDING`,
              properties: API_V2010_ACCOUNT_RECORDINGFields,
          });          
        }
    });
  