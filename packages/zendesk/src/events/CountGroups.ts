
                    import { EventHandler } from '@arkw/core';
                    import { GroupsCountObjectFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CountGroups: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-GroupsCountObject-CountGroups`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/groups/count'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching CountGroups", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `GroupsCountObject`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `GroupsCountObject`,
                                properties: GroupsCountObjectFields,
                            });
                        },
                })
                