
                    import { EventHandler } from '@arkw/core';
                    import { PagingSavedEpisodeObjectFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -users-saved-episodes: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-PagingSavedEpisodeObject`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { QueryMarket,QueryLimit,QueryOffset,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/me/episodes'].get({
                                query: {QueryMarket,QueryLimit,QueryOffset,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `PagingSavedEpisodeObject`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `PagingSavedEpisodeObject`,
                                properties: PagingSavedEpisodeObjectFields,
                            });
                        },
                })
                