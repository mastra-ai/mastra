
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_RECORDING_RECORDING_TRANSCRIPTIONFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListRecordingTranscription: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient, config },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_RECORDING_RECORDING_TRANSCRIPTION-ListRecordingTranscription`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { PageSize, Page, PageToken, AccountSid, RecordingSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Recordings/{RecordingSid}/Transcriptions.json'].get({
            params: { AccountSid, RecordingSid },
            query: { PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListRecordingTranscription", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d?.['transcriptions']?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_RECORDING_RECORDING_TRANSCRIPTIONFields,
            } 
          })

          if (records && records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_RECORDING_RECORDING_TRANSCRIPTION`,
                properties: API_V2010_ACCOUNT_RECORDING_RECORDING_TRANSCRIPTIONFields,
            });             
          }
        }
    });
  