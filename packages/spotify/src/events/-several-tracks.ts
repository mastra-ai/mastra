
                    import { EventHandler } from '@arkw/core';
                    import { ManyTracksFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -several-tracks: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ManyTracks`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { QueryMarket,QueryTrackIds,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/tracks'].get({
                                query: {QueryMarket,QueryTrackIds,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ManyTracks`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ManyTracks`,
                                properties: ManyTracksFields,
                            });
                        },
                })
                