
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_CONFERENCE_PARTICIPANTFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchParticipant: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_CONFERENCE_PARTICIPANT-FetchParticipant`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, ConferenceSid, CallSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Conferences/{ConferenceSid}/Participants/{CallSid}.json'].get({
            params: { AccountSid, ConferenceSid, CallSid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchParticipant", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()
        }
    });
  