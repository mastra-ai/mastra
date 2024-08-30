
                    import { EventHandler } from '@arkw/core';
                    import { PagingSimplifiedChapterObjectFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -audiobook-chapters: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-PagingSimplifiedChapterObject`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { PathAudiobookId,QueryMarket,QueryLimit,QueryOffset, id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/audiobooks/{id}/chapters'].get({
                                query: {PathAudiobookId,QueryMarket,QueryLimit,QueryOffset,},
                                params: {id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `PagingSimplifiedChapterObject`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `PagingSimplifiedChapterObject`,
                                properties: PagingSimplifiedChapterObjectFields,
                            });
                        },
                })
                