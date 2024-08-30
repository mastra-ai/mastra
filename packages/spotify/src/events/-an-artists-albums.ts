
                    import { EventHandler } from '@arkw/core';
                    import { PagingSimplifiedAlbumObjectFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -an-artists-albums: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-PagingSimplifiedAlbumObject`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { PathArtistId,QueryIncludeGroups,QueryMarket,QueryLimit,QueryOffset, id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/artists/{id}/albums'].get({
                                query: {PathArtistId,QueryIncludeGroups,QueryMarket,QueryLimit,QueryOffset,},
                                params: {id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `PagingSimplifiedAlbumObject`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `PagingSimplifiedAlbumObject`,
                                properties: PagingSimplifiedAlbumObjectFields,
                            });
                        },
                })
                