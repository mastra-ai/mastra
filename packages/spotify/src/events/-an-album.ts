
                    import { EventHandler } from '@arkw/core';
                    import { OneAlbumFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -an-album: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OneAlbum`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { PathAlbumId,QueryMarket, id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/albums/{id}'].get({
                                query: {PathAlbumId,QueryMarket,},
                                params: {id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OneAlbum`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OneAlbum`,
                                properties: OneAlbumFields,
                            });
                        },
                })
                