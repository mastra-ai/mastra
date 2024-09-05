
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_CONFERENCE_PARTICIPANTFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListParticipant: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient, config },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_CONFERENCE_PARTICIPANT-ListParticipant`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { Muted, Hold, Coaching, PageSize, Page, PageToken, AccountSid, ConferenceSid } = event.data;
          const proxy = await getApiClient({ referenceId })        

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/Conferences/{ConferenceSid}/Participants.json'].get({
            params: { AccountSid, ConferenceSid },
            query: { Muted, Hold, Coaching, PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListParticipant", JSON.stringify(error, null, 2));
            return
          }        
          
          const d = await response.json()

          const records = d?.['participants']?.map((r) => {
            return {
              externalId: r.account_sid,
              record: r,
              entityType: API_V2010_ACCOUNT_CONFERENCE_PARTICIPANTFields,
            } 
          })

          if (records && records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_CONFERENCE_PARTICIPANT`,
                properties: API_V2010_ACCOUNT_CONFERENCE_PARTICIPANTFields,
            });             
          }
        }
    });
  