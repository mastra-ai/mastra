
                    import { EventHandler } from '@arkw/core';
                    import { ManyAudiobooksFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -multiple-audiobooks: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ManyAudiobooks`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { QueryAudiobookIds,QueryMarket,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/audiobooks'].get({
                                query: {QueryAudiobookIds,QueryMarket,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ManyAudiobooks`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ManyAudiobooks`,
                                properties: ManyAudiobooksFields,
                            });
                        },
                })
                