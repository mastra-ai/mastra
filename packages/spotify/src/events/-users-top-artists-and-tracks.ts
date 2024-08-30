
                    import { EventHandler } from '@arkw/core';
                    import { PagingArtistOrTrackObjectFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -users-top-artists-and-tracks: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-PagingArtistOrTrackObject`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { type,time_range,QueryLimit,QueryOffset, type,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/me/top/{type}'].get({
                                query: {type,time_range,QueryLimit,QueryOffset,},
                                params: {type,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `PagingArtistOrTrackObject`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `PagingArtistOrTrackObject`,
                                properties: PagingArtistOrTrackObjectFields,
                            });
                        },
                })
                