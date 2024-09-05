
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_QUEUE_MEMBERFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchMember: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_QUEUE_MEMBER-FetchMember`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, QueueSid, CallSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Queues/{QueueSid}/Members/{CallSid}.json'].get({
            params: { AccountSid, QueueSid, CallSid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchMember", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()
        }
    });
  