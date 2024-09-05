
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_AUTHORIZED_CONNECT_APPFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchAuthorizedConnectApp: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_AUTHORIZED_CONNECT_APP-FetchAuthorizedConnectApp`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, ConnectAppSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/AuthorizedConnectApps/{ConnectAppSid}.json'].get({
            params: { AccountSid, ConnectAppSid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchAuthorizedConnectApp", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()
        }
    });
  