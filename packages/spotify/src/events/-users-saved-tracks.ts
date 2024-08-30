
                    import { EventHandler } from '@arkw/core';
                    import { PagingSavedTrackObjectFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -users-saved-tracks: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-PagingSavedTrackObject`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { QueryMarket,QueryLimit,QueryOffset,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/me/tracks'].get({
                                query: {QueryMarket,QueryLimit,QueryOffset,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `PagingSavedTrackObject`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `PagingSavedTrackObject`,
                                properties: PagingSavedTrackObjectFields,
                            });
                        },
                })
                