
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_KEYFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchKey: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_KEY-FetchKey`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, Sid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Keys/{Sid}.json'].get({
            params: { AccountSid, Sid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchKey", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()
        }
    });
  