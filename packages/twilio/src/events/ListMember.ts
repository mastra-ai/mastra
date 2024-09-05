
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_QUEUE_MEMBERFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListMember: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient, config },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_QUEUE_MEMBER-ListMember`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { PageSize, Page, PageToken, AccountSid, QueueSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Queues/{QueueSid}/Members.json'].get({
            params: { AccountSid, QueueSid },
            query: { PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListMember", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d?.['queue_members']?.map((r) => {
            return {
              externalId: r.call_sid,
              record: r,
              entityType: API_V2010_ACCOUNT_QUEUE_MEMBERFields,
            } 
          })

          if (records && records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_QUEUE_MEMBER`,
                properties: API_V2010_ACCOUNT_QUEUE_MEMBERFields,
            });             
          }
        }
    });
  