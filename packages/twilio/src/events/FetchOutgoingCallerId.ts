
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_OUTGOING_CALLER_IDFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchOutgoingCallerId: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_OUTGOING_CALLER_ID-FetchOutgoingCallerId`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, Sid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/OutgoingCallerIds/{Sid}.json'].get({
            params: { AccountSid, Sid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchOutgoingCallerId", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()
        }
    });
  