
                    import { EventHandler } from '@arkw/core';
                    import { ManyChaptersFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -several-chapters: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ManyChapters`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { QueryChapterIds,QueryMarket,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/chapters'].get({
                                query: {QueryChapterIds,QueryMarket,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ManyChapters`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ManyChapters`,
                                properties: ManyChaptersFields,
                            });
                        },
                })
                