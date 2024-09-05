
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_SIP_SIP_CREDENTIAL_LISTFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListSipCredentialList: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient, config },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_SIP_SIP_CREDENTIAL_LIST-ListSipCredentialList`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { PageSize, Page, PageToken, AccountSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/SIP/CredentialLists.json'].get({
            params: { AccountSid },
            query: { PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListSipCredentialList", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d?.['credential_lists']?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_SIP_SIP_CREDENTIAL_LISTFields,
            } 
          })

          if (records && records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_SIP_SIP_CREDENTIAL_LIST`,
                properties: API_V2010_ACCOUNT_SIP_SIP_CREDENTIAL_LISTFields,
            });             
          }
        }
    });
  