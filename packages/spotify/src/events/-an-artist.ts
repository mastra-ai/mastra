
                    import { EventHandler } from '@arkw/core';
                    import { OneArtistFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -an-artist: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OneArtist`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { PathArtistId, id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/artists/{id}'].get({
                                query: {PathArtistId,},
                                params: {id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OneArtist`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OneArtist`,
                                properties: OneArtistFields,
                            });
                        },
                })
                