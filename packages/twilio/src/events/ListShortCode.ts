
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_SHORT_CODEFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListShortCode: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_SHORT_CODE-ListShortCode`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { FriendlyName, ShortCode, PageSize, Page, PageToken, AccountSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/SMS/ShortCodes.json'].get({
            params: { AccountSid },
            query: { FriendlyName, ShortCode, PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListShortCode", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d?.['short_codes']?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_SHORT_CODEFields,
            } 
          })

          if (records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_SHORT_CODE`,
                properties: API_V2010_ACCOUNT_SHORT_CODEFields,
            });             
          }
        }
    });
  