
                    import { EventHandler } from '@arkw/core';
                    import { CursorPagedArtistsFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -followed: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CursorPagedArtists`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { type,after,limit,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/me/following'].get({
                                query: {type,after,limit,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CursorPagedArtists`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CursorPagedArtists`,
                                properties: CursorPagedArtistsFields,
                            });
                        },
                })
                