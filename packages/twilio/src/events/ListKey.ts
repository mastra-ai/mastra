
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_KEYFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListKey: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_KEY-ListKey`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { PageSize, Page, PageToken, AccountSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Keys.json'].get({
            params: { AccountSid },
            query: { PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListKey", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d?.['keys']?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_KEYFields,
            } 
          })

          if (records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_KEY`,
                properties: API_V2010_ACCOUNT_KEYFields,
            });             
          }
        }
    });
  