
                    import { EventHandler } from '@arkw/core';
                    import { GroupsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListGroups: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-GroupsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { UserId,ExcludeDeleted,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/groups'].get({
                                query: {UserId,ExcludeDeleted,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `GroupsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `GroupsResponse`,
                                properties: GroupsResponseFields,
                            });
                        },
                })
                