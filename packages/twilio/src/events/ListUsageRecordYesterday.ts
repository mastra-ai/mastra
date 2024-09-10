
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_YESTERDAYFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListUsageRecordYesterday: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient, config },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_YESTERDAY-ListUsageRecordYesterday`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { Category, StartDate, EndDate, IncludeSubaccounts, PageSize, Page, PageToken, AccountSid } = event.data;
          const proxy = await getApiClient({ referenceId })

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Usage/Records/Yesterday.json'].get({
            params: { AccountSid },
            query: { Category, StartDate, EndDate, IncludeSubaccounts, PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListUsageRecordYesterday", JSON.stringify(error, null, 2));
            return
          }

          const d = await response.json()

          const records = d?.['usage_records']?.map((r) => {
            return {
              externalId: r.account_sid,
              record: r,
              entityType: API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_YESTERDAYFields,
            }
          })

          if (records && records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_YESTERDAY`,
                properties: API_V2010_ACCOUNT_USAGE_USAGE_RECORD_USAGE_RECORD_YESTERDAYFields,
            });
          }
        }
    });
  