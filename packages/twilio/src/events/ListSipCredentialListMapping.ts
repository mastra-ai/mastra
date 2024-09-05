
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_CREDENTIAL_LIST_MAPPINGFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListSipCredentialListMapping: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_CREDENTIAL_LIST_MAPPING-ListSipCredentialListMapping`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { PageSize, Page, PageToken, AccountSid, DomainSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/SIP/Domains/{DomainSid}/CredentialListMappings.json'].get({
            params: { AccountSid, DomainSid },
            query: { PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListSipCredentialListMapping", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_CREDENTIAL_LIST_MAPPINGFields,
            } 
          })

          await dataLayer?.syncData({
              name,
              referenceId,
              data: records,
              type: `API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_CREDENTIAL_LIST_MAPPING`,
              properties: API_V2010_ACCOUNT_SIP_SIP_DOMAIN_SIP_CREDENTIAL_LIST_MAPPINGFields,
          });          
        }
    });
  