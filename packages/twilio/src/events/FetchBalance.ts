
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_BALANCEFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchBalance: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_BALANCE-FetchBalance`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Balance.json'].get({
            params: { AccountSid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchBalance", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()
        }
    });
  