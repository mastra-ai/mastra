
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_MESSAGE_MEDIAFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListMedia: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_MESSAGE_MEDIA-ListMedia`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { DateCreated, DateCreated<, DateCreated>, PageSize, Page, PageToken, AccountSid, MessageSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Messages/{MessageSid}/Media.json'].get({
            params: { AccountSid, MessageSid },
            query: { DateCreated, DateCreated<, DateCreated>, PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListMedia", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_MESSAGE_MEDIAFields,
            } 
          })

          await dataLayer?.syncData({
              name,
              referenceId,
              data: records,
              type: `API_V2010_ACCOUNT_MESSAGE_MEDIA`,
              properties: API_V2010_ACCOUNT_MESSAGE_MEDIAFields,
          });          
        }
    });
  