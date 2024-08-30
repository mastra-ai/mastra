
                    import { EventHandler } from '@arkw/core';
                    import { OneShowFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -a-show: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OneShow`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { QueryMarket,PathShowId, id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/shows/{id}'].get({
                                query: {QueryMarket,PathShowId,},
                                params: {id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OneShow`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OneShow`,
                                properties: OneShowFields,
                            });
                        },
                })
                