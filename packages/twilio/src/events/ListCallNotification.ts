
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_CALL_CALL_NOTIFICATIONFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListCallNotification: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_CALL_CALL_NOTIFICATION-ListCallNotification`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { Log, MessageDate, MessageDate<, MessageDate>, PageSize, Page, PageToken, AccountSid, CallSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}/Notifications.json'].get({
            params: { AccountSid, CallSid },
            query: { Log, MessageDate, MessageDate<, MessageDate>, PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListCallNotification", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_CALL_CALL_NOTIFICATIONFields,
            } 
          })

          await dataLayer?.syncData({
              name,
              referenceId,
              data: records,
              type: `API_V2010_ACCOUNT_CALL_CALL_NOTIFICATION`,
              properties: API_V2010_ACCOUNT_CALL_CALL_NOTIFICATIONFields,
          });          
        }
    });
  