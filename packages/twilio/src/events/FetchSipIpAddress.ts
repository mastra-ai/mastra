
    import { EventHandler } from '@arkw/core';
    import { API_V2010_ACCOUNT_SIP_SIP_IP_ACCESS_CONTROL_LIST_SIP_IP_ADDRESSFields } from '../constants';
    import { TwilioIntegration } from '..';

    export const FetchSipIpAddress: EventHandler<TwilioIntegration> = ({
      eventKey,
      integrationInstance: { name, dataLayer, getApiClient, config },
      makeWebhookUrl,
    }) => ({
        id: `${name}-sync-API_V2010_ACCOUNT_SIP_SIP_IP_ACCESS_CONTROL_LIST_SIP_IP_ADDRESS-FetchSipIpAddress`,
        event: eventKey,
        executor: async ({ event, step }: any) => {
          const { referenceId } = event.user;
          const { AccountSid, IpAccessControlListSid, Sid } = event.data;
          const proxy = await getApiClient({ referenceId })

          // @ts-ignore
          const response = await proxy['/2010-04-01/Accounts/{AccountSid}/SIP/IpAccessControlLists/{IpAccessControlListSid}/IpAddresses/{Sid}.json'].get({
            params: { AccountSid, IpAccessControlListSid, Sid },
            
          })

          if (!response.ok) {
            const error = await response.json();
            console.log("error in fetching FetchSipIpAddress", JSON.stringify(error, null, 2));
            return
          }

          const d = await response.json()

          const records = [d]?.map((r) => {
            return {
              externalId: r.sid,
              record: r,
              entityType: API_V2010_ACCOUNT_SIP_SIP_IP_ACCESS_CONTROL_LIST_SIP_IP_ADDRESSFields,
            }
          })

          if (records && records?.length > 0) {
            await dataLayer?.syncData({
                name,
                referenceId,
                data: records,
                type: `API_V2010_ACCOUNT_SIP_SIP_IP_ACCESS_CONTROL_LIST_SIP_IP_ADDRESS`,
                properties: API_V2010_ACCOUNT_SIP_SIP_IP_ACCESS_CONTROL_LIST_SIP_IP_ADDRESSFields,
            });
          }
        }
    });
  