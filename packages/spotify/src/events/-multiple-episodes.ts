
                    import { EventHandler } from '@arkw/core';
                    import { ManyEpisodesFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -multiple-episodes: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ManyEpisodes`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { ids,QueryMarket,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/episodes'].get({
                                query: {ids,QueryMarket,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ManyEpisodes`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ManyEpisodes`,
                                properties: ManyEpisodesFields,
                            });
                        },
                })
                