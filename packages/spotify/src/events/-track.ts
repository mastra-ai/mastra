
                    import { EventHandler } from '@arkw/core';
                    import { OneTrackFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -track: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OneTrack`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { id,QueryMarket, id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/tracks/{id}'].get({
                                query: {id,QueryMarket,},
                                params: {id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OneTrack`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OneTrack`,
                                properties: OneTrackFields,
                            });
                        },
                })
                