
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_IP_ACCESS_CONTROL_LIST_MAPPINGFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListSipIpAccessControlListMapping: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_IP_ACCESS_CONTROL_LIST_MAPPING-ListSipIpAccessControlListMapping`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { PageSize, Page, PageToken, AccountSid, DomainSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/IpAccessControlListMappings.json'].get({
            params: { AccountSid, DomainSid },
            query: { PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListSipIpAccessControlListMapping", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d?.['ip_access_control_list_mappings']?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_IP_ACCESS_CONTROL_LIST_MAPPINGFields,
            } 
          })

          if (records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_IP_ACCESS_CONTROL_LIST_MAPPING`,
                properties: API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_IP_ACCESS_CONTROL_LIST_MAPPINGFields,
            });             
          }
        }
    });
  