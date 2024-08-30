
                    import { EventHandler } from '@arkw/core';
                    import { ManySimplifiedShowsFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -multiple-shows: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ManySimplifiedShows`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { QueryMarket,QueryShowIds,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/shows'].get({
                                query: {QueryMarket,QueryShowIds,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ManySimplifiedShows`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ManySimplifiedShows`,
                                properties: ManySimplifiedShowsFields,
                            });
                        },
                })
                