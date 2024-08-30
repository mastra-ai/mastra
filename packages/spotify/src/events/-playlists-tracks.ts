
                    import { EventHandler } from '@arkw/core';
                    import { PagingPlaylistTrackObjectFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -playlists-tracks: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-PagingPlaylistTrackObject`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { PathPlaylistId,QueryMarket,fields,QueryLimit,QueryOffset,QueryAdditionalTypes, playlist_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/playlists/{playlist_id}/tracks'].get({
                                query: {PathPlaylistId,QueryMarket,fields,QueryLimit,QueryOffset,QueryAdditionalTypes,},
                                params: {playlist_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `PagingPlaylistTrackObject`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `PagingPlaylistTrackObject`,
                                properties: PagingPlaylistTrackObjectFields,
                            });
                        },
                })
                