
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_SHORT_CODEFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchShortCode: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_SHORT_CODE-FetchShortCode`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, Sid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/SMS/ShortCodes/{Sid}.json'].get({
            params: { AccountSid, Sid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchShortCode", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()
        }
    });
  