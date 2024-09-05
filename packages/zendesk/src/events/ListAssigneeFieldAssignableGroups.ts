
                    import { EventHandler } from '@arkw/core';
                    import { AssigneeFieldAssignableGroupsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListAssigneeFieldAssignableGroups: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-AssigneeFieldAssignableGroupsResponse-ListAssigneeFieldAssignableGroups`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/lotus/assignables/groups.json'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListAssigneeFieldAssignableGroups", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `AssigneeFieldAssignableGroupsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `AssigneeFieldAssignableGroupsResponse`,
                                properties: AssigneeFieldAssignableGroupsResponseFields,
                            });
                        },
                })
                