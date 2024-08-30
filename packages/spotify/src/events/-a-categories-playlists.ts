
                    import { EventHandler } from '@arkw/core';
                    import { PagedFeaturedPlaylistsFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -a-categories-playlists: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-PagedFeaturedPlaylists`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { category_id,country,QueryLimit,QueryOffset, category_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/browse/categories/{category_id}/playlists'].get({
                                query: {category_id,country,QueryLimit,QueryOffset,},
                                params: {category_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `PagedFeaturedPlaylists`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `PagedFeaturedPlaylists`,
                                properties: PagedFeaturedPlaylistsFields,
                            });
                        },
                })
                