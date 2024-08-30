
                    import { EventHandler } from '@arkw/core';
                    import { OneAudiobookFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -an-audiobook: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OneAudiobook`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { PathAudiobookId,QueryMarket, id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/audiobooks/{id}'].get({
                                query: {PathAudiobookId,QueryMarket,},
                                params: {id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OneAudiobook`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OneAudiobook`,
                                properties: OneAudiobookFields,
                            });
                        },
                })
                