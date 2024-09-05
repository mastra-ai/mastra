
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_ALL_TIMEFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListUsageRecordAllTime: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_ALL_TIME-ListUsageRecordAllTime`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { Category, StartDate, EndDate, IncludeSubaccounts, PageSize, Page, PageToken, AccountSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Usage/Records/AllTime.json'].get({
            params: { AccountSid },
            query: { Category, StartDate, EndDate, IncludeSubaccounts, PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListUsageRecordAllTime", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d.map((r) => {
            return {
              externalId: r.account_sid,
              record: r,
              entityType: API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_ALL_TIMEFields,
            } 
          })

          await dataLayer?.syncData({
              name,
              referenceId,
              data: records,
              type: `API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_ALL_TIME`,
              properties: API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_ALL_TIMEFields,
          });          
        }
    });
  