
                    import { EventHandler } from '@arkw/core';
                    import { ViewsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const SearchViews: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ViewsResponse-SearchViews`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { query,access,active,group_id,sort_by,sort_order,include,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/views/search'].get({
                                query: {query,access,active,group_id,sort_by,sort_order,include,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching SearchViews", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ViewsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ViewsResponse`,
                                properties: ViewsResponseFields,
                            });
                        },
                })
                