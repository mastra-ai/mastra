
                    import { EventHandler } from '@arkw/core';
                    import { ManyArtistsFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -multiple-artists: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ManyArtists`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { ids,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/artists'].get({
                                query: {ids,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ManyArtists`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ManyArtists`,
                                properties: ManyArtistsFields,
                            });
                        },
                })
                