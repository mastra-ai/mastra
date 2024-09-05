
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_RECORDING_RECORDING_TRANSCRIPTIONFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchRecordingTranscription: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_RECORDING_RECORDING_TRANSCRIPTION-FetchRecordingTranscription`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, RecordingSid, Sid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Recordings/{RecordingSid}/Transcriptions/{Sid}.json'].get({
            params: { AccountSid, RecordingSid, Sid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchRecordingTranscription", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()
        }
    });
  