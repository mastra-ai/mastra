
                    import { EventHandler } from '@arkw/core';
                    import { GroupSLAPoliciesResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListGroupSLAPolicies: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-GroupSLAPoliciesResponse-ListGroupSLAPolicies`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/group_slas/policies'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListGroupSLAPolicies", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `GroupSLAPoliciesResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `GroupSLAPoliciesResponse`,
                                properties: GroupSLAPoliciesResponseFields,
                            });
                        },
                })
                