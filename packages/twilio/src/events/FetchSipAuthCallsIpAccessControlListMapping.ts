
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_CALLS_SIP_AUTH_CALLS_IP_ACCESS_CONTROL_LIST_MAPPINGFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchSipAuthCallsIpAccessControlListMapping: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_CALLS_SIP_AUTH_CALLS_IP_ACCESS_CONTROL_LIST_MAPPING-FetchSipAuthCallsIpAccessControlListMapping`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, DomainSid, Sid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/Auth/Calls/IpAccessControlListMappings/{Sid}.json'].get({
            params: { AccountSid, DomainSid, Sid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchSipAuthCallsIpAccessControlListMapping", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = [d].map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_CALLS_SIP_AUTH_CALLS_IP_ACCESS_CONTROL_LIST_MAPPINGFields,
            } 
          })

          await dataLayer?.syncData({
              name,
              referenceId,
              data: records,
              type: `API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_CALLS_SIP_AUTH_CALLS_IP_ACCESS_CONTROL_LIST_MAPPING`,
              properties: API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_AUTH_SIP_AUTH_CALLS_SIP_AUTH_CALLS_IP_ACCESS_CONTROL_LIST_MAPPINGFields,
          });          
        }
    });
  