
                    import { EventHandler } from '@arkw/core';
                    import { PagingSimplifiedEpisodeObjectFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -a-shows-episodes: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-PagingSimplifiedEpisodeObject`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { PathShowId,QueryMarket,QueryLimit,QueryOffset, id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/shows/{id}/episodes'].get({
                                query: {PathShowId,QueryMarket,QueryLimit,QueryOffset,},
                                params: {id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `PagingSimplifiedEpisodeObject`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `PagingSimplifiedEpisodeObject`,
                                properties: PagingSimplifiedEpisodeObjectFields,
                            });
                        },
                })
                