
                    import { EventHandler } from '@arkw/core';
                    import { GroupMembershipResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowGroupMembershipById: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-GroupMembershipResponse-ShowGroupMembershipById`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  group_membership_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/group_memberships/{group_membership_id}'].get({
                                
                                params: {group_membership_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowGroupMembershipById", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `GroupMembershipResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `GroupMembershipResponse`,
                                properties: GroupMembershipResponseFields,
                            });
                        },
                })
                