
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON_EXTENSIONFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const ListIncomingPhoneNumberAssignedAddOnExtension: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient, config },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON_EXTENSION-ListIncomingPhoneNumberAssignedAddOnExtension`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { PageSize, Page, PageToken, AccountSid, ResourceSid, AssignedAddOnSid } = event.data;
          const proxy = await getApiClient({ referenceId })

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/IncomingPhoneNumbers/{ResourceSid}/AssignedAddOns/{AssignedAddOnSid}/Extensions.json'].get({
            params: { AccountSid, ResourceSid, AssignedAddOnSid },
            query: { PageSize, Page, PageToken },
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching ListIncomingPhoneNumberAssignedAddOnExtension", JSON.stringify(error, null, 2));
            return
          }

          const d = await response.json()

          const records = d?.['extensions']?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON_EXTENSIONFields,
            }
          })

          if (records && records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON_EXTENSION`,
                properties: API_V2010_ACCOUNT_INCOMING_PHONE_NUMBER_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON_INCOMING_PHONE_NUMBER_ASSIGNED_ADD_ON_EXTENSIONFields,
            });
          }
        }
    });
  