
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_SIP_SIP_IP_ACCESS_CONTROL_LISTFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchSipIpAccessControlList: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_SIP_SIP_IP_ACCESS_CONTROL_LIST-FetchSipIpAccessControlList`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, Sid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/SIP/IpAccessControlLists/{Sid}.json'].get({
            params: { AccountSid, Sid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchSipIpAccessControlList", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()
        }
    });
  