
                    import { EventHandler } from '@arkw/core';
                    import { PagedPlaylistsFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -a-list-of-current-users-playlists: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-PagedPlaylists`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { QueryLimit,offset,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/me/playlists'].get({
                                query: {QueryLimit,offset,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `PagedPlaylists`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `PagedPlaylists`,
                                properties: PagedPlaylistsFields,
                            });
                        },
                })
                