
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_NOTIFICATIONFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListNotification: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_NOTIFICATION-ListNotification`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { Log, MessageDate, MessageDate<, MessageDate>, PageSize, Page, PageToken, AccountSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Notifications.json'].get({
            params: { AccountSid },
            query: { Log, MessageDate, MessageDate<, MessageDate>, PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListNotification", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d?.['notifications']?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_NOTIFICATIONFields,
            } 
          })

          if (records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_NOTIFICATION`,
                properties: API_V2010_ACCOUNT_NOTIFICATIONFields,
            });             
          }
        }
    });
  