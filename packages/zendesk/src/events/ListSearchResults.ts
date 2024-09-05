
                    import { EventHandler } from '@arkw/core';
                    import { SearchResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListSearchResults: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SearchResponse-ListSearchResults`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { query,sort_by,sort_order,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/search'].get({
                                query: {query,sort_by,sort_order,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListSearchResults", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SearchResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SearchResponse`,
                                properties: SearchResponseFields,
                            });
                        },
                })
                