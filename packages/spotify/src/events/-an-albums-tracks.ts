
                    import { EventHandler } from '@arkw/core';
                    import { PagingSimplifiedTrackObjectFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -an-albums-tracks: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-PagingSimplifiedTrackObject`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { PathAlbumId,QueryMarket,QueryLimit,QueryOffset, id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/albums/{id}/tracks'].get({
                                query: {PathAlbumId,QueryMarket,QueryLimit,QueryOffset,},
                                params: {id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `PagingSimplifiedTrackObject`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `PagingSimplifiedTrackObject`,
                                properties: PagingSimplifiedTrackObjectFields,
                            });
                        },
                })
                