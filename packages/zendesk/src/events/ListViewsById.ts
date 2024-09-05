
                    import { EventHandler } from '@arkw/core';
                    import { ViewsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListViewsById: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ViewsResponse-ListViewsById`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { ids,active,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/views/show_many'].get({
                                query: {ids,active,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListViewsById", {response});
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
                