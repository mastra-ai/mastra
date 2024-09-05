
                    import { EventHandler } from '@arkw/core';
                    import { AssigneeFieldAssignableGroupAgentsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListAssigneeFieldAssignableGroupAgents: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-AssigneeFieldAssignableGroupAgentsResponse-ListAssigneeFieldAssignableGroupAgents`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { GroupId, group_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/lotus/assignables/groups/{group_id}/agents.json'].get({
                                query: {GroupId,},
                                params: {group_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ListAssigneeFieldAssignableGroupAgents", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `AssigneeFieldAssignableGroupAgentsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `AssigneeFieldAssignableGroupAgentsResponse`,
                                properties: AssigneeFieldAssignableGroupAgentsResponseFields,
                            });
                        },
                })
                