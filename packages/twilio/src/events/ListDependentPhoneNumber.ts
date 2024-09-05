
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_ADDRESS_DEPENDENT_PHONE_NUMBERFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListDependentPhoneNumber: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_ADDRESS_DEPENDENT_PHONE_NUMBER-ListDependentPhoneNumber`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { PageSize, Page, PageToken, AccountSid, AddressSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Addresses/{AddressSid}/DependentPhoneNumbers.json'].get({
            params: { AccountSid, AddressSid },
            query: { PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListDependentPhoneNumber", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d?.['dependent_phone_numbers']?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_ADDRESS_DEPENDENT_PHONE_NUMBERFields,
            } 
          })

          if (records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_ADDRESS_DEPENDENT_PHONE_NUMBER`,
                properties: API_V2010_ACCOUNT_ADDRESS_DEPENDENT_PHONE_NUMBERFields,
            });             
          }
        }
    });
  