
                    import { EventHandler } from '@arkw/core';
                    import { OnePlaylistFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -playlist: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OnePlaylist`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { PathPlaylistId,QueryMarket,fields,QueryAdditionalTypes, playlist_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/playlists/{playlist_id}'].get({
                                query: {PathPlaylistId,QueryMarket,fields,QueryAdditionalTypes,},
                                params: {playlist_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OnePlaylist`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OnePlaylist`,
                                properties: OnePlaylistFields,
                            });
                        },
                })
                