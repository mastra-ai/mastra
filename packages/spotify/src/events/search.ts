
                    import { EventHandler } from '@arkw/core';
                    import { SearchItemsFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const search: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SearchItems`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { q,type,QueryMarket,limit,offset,include_external,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/search'].get({
                                query: {q,type,QueryMarket,limit,offset,include_external,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SearchItems`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SearchItems`,
                                properties: SearchItemsFields,
                            });
                        },
                })
                