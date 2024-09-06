
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_SIGNING_KEYFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListSigningKey: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient, config },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_SIGNING_KEY-ListSigningKey`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { PageSize, Page, PageToken, AccountSid } = event.data;
          const proxy = await getApiClient({ referenceId })

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/SigningKeys.json'].get({
            params: { AccountSid },
            query: { PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListSigningKey", JSON.stringify(error, null, 2));
            return
          }

          const d = await response.json()

          const records = d?.['signing_keys']?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_SIGNING_KEYFields,
            }
          })

          if (records && records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_SIGNING_KEY`,
                properties: API_V2010_ACCOUNT_SIGNING_KEYFields,
            });
          }
        }
    });
  