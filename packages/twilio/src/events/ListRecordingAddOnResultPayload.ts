
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_RECORDING_RECORDING_ADD_ON_RESULT_RECORDING_ADD_ON_RESULT_PAYLOADFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListRecordingAddOnResultPayload: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_RECORDING_RECORDING_ADD_ON_RESULT_RECORDING_ADD_ON_RESULT_PAYLOAD-ListRecordingAddOnResultPayload`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { PageSize, Page, PageToken, AccountSid, ReferenceSid, AddOnResultSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Recordings/{ReferenceSid}/AddOnResults/{AddOnResultSid}/Payloads.json'].get({
            params: { AccountSid, ReferenceSid, AddOnResultSid },
            query: { PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListRecordingAddOnResultPayload", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_RECORDING_RECORDING_ADD_ON_RESULT_RECORDING_ADD_ON_RESULT_PAYLOADFields,
            } 
          })

          await dataLayer?.syncData({
              name,
              referenceId,
              data: records,
              type: `API_V2010_ACCOUNT_RECORDING_RECORDING_ADD_ON_RESULT_RECORDING_ADD_ON_RESULT_PAYLOAD`,
              properties: API_V2010_ACCOUNT_RECORDING_RECORDING_ADD_ON_RESULT_RECORDING_ADD_ON_RESULT_PAYLOADFields,
          });          
        }
    });
  