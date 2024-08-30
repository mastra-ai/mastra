
                    import { EventHandler } from '@arkw/core';
                    import { PagingSavedAlbumObjectFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -users-saved-albums: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-PagingSavedAlbumObject`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { QueryLimit,QueryOffset,QueryMarket,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/me/albums'].get({
                                query: {QueryLimit,QueryOffset,QueryMarket,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `PagingSavedAlbumObject`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `PagingSavedAlbumObject`,
                                properties: PagingSavedAlbumObjectFields,
                            });
                        },
                })
                