
                    import { EventHandler } from '@arkw/core';
                    import { ArrayOfImagesFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -playlist-cover: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ArrayOfImages`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { PathPlaylistId, playlist_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/playlists/{playlist_id}/images'].get({
                                query: {PathPlaylistId,},
                                params: {playlist_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ArrayOfImages`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ArrayOfImages`,
                                properties: ArrayOfImagesFields,
                            });
                        },
                })
                