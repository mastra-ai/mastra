
                    import { EventHandler } from '@arkw/core';
                    import { PagedCategoriesFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -categories: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-PagedCategories`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { country,locale,QueryLimit,QueryOffset,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/browse/categories'].get({
                                query: {country,locale,QueryLimit,QueryOffset,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `PagedCategories`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `PagedCategories`,
                                properties: PagedCategoriesFields,
                            });
                        },
                })
                