
                    import { EventHandler } from '@arkw/core';
                    import { GroupsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListAssignableGroups: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-GroupsResponse-ListAssignableGroups`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/groups/assignable'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListAssignableGroups", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
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
                