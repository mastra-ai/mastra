
                    import { EventHandler } from '@arkw/core';
                    import { OneChapterFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -a-chapter: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OneChapter`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { PathChapterId,QueryMarket, id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/chapters/{id}'].get({
                                query: {PathChapterId,QueryMarket,},
                                params: {id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OneChapter`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OneChapter`,
                                properties: OneChapterFields,
                            });
                        },
                })
                