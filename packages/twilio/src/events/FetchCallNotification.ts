
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_CALL_CALL_NOTIFICATION_INSTANCEFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchCallNotification: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_CALL_CALL_NOTIFICATION_INSTANCE-FetchCallNotification`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, CallSid, Sid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Notifications/{Sid}.json'].get({
            params: { AccountSid, CallSid, Sid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchCallNotification", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()
        }
    });
  