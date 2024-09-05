
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_SIP_SIP_CREDENTIAL_LIST_SIP_CREDENTIALFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchSipCredential: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_SIP_SIP_CREDENTIAL_LIST_SIP_CREDENTIAL-FetchSipCredential`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, CredentialListSid, Sid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/SIP/CredentialLists/{CredentialListSid}/Credentials/{Sid}.json'].get({
            params: { AccountSid, CredentialListSid, Sid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchSipCredential", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = [d].map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_SIP_SIP_CREDENTIAL_LIST_SIP_CREDENTIALFields,
            } 
          })

          await dataLayer?.syncData({
              name,
              referenceId,
              data: records,
              type: `API_V2010_ACCOUNT_SIP_SIP_CREDENTIAL_LIST_SIP_CREDENTIAL`,
              properties: API_V2010_ACCOUNT_SIP_SIP_CREDENTIAL_LIST_SIP_CREDENTIALFields,
          });          
        }
    });
  