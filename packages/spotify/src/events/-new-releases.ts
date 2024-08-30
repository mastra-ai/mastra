
                    import { EventHandler } from '@arkw/core';
                    import { PagedAlbumsFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -new-releases: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-PagedAlbums`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { country,QueryLimit,QueryOffset,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/browse/new-releases'].get({
                                query: {country,QueryLimit,QueryOffset,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `PagedAlbums`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `PagedAlbums`,
                                properties: PagedAlbumsFields,
                            });
                        },
                })
                