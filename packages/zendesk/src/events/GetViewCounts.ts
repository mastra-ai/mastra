
                    import { EventHandler } from '@arkw/core';
                    import { ViewCountsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const GetViewCounts: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ViewCountsResponse-GetViewCounts`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { ids,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/views/count_many'].get({
                                query: {ids,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching GetViewCounts", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ViewCountsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ViewCountsResponse`,
                                properties: ViewCountsResponseFields,
                            });
                        },
                })
                