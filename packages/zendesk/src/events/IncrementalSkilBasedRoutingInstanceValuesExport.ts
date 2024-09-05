
                    import { EventHandler } from '@arkw/core';
                    import { IncrementalSkillBasedRoutingFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const IncrementalSkilBasedRoutingInstanceValuesExport: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-IncrementalSkillBasedRouting-IncrementalSkilBasedRoutingInstanceValuesExport`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/incremental/routing/instance_values'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching IncrementalSkilBasedRoutingInstanceValuesExport", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `IncrementalSkillBasedRouting`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `IncrementalSkillBasedRouting`,
                                properties: IncrementalSkillBasedRoutingFields,
                            });
                        },
                })
                