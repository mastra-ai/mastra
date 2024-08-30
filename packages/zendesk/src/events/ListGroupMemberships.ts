
                    import { EventHandler } from '@arkw/core';
                    import { GroupMembershipsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListGroupMemberships: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-GroupMembershipsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { GroupId,UserId,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/group_memberships'].get({
                                query: {GroupId,UserId,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `GroupMembershipsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `GroupMembershipsResponse`,
                                properties: GroupMembershipsResponseFields,
                            });
                        },
                })
                