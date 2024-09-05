
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_MESSAGE_MEDIAFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchMedia: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_MESSAGE_MEDIA-FetchMedia`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, MessageSid, Sid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Messages/{MessageSid}/Media/{Sid}.json'].get({
            params: { AccountSid, MessageSid, Sid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchMedia", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()
        }
    });
  