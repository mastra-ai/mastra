
                    import { EventHandler } from '@arkw/core';
                    import { ManyTracksFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -an-artists-top-tracks: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ManyTracks`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { PathArtistId,QueryMarket, id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/artists/{id}/top-tracks'].get({
                                query: {PathArtistId,QueryMarket,},
                                params: {id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ManyTracks`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ManyTracks`,
                                properties: ManyTracksFields,
                            });
                        },
                })
                