
                    import { EventHandler } from '@arkw/core';
                    import { OneCurrentlyPlayingFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -information-about-the-users-current-playback: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OneCurrentlyPlaying`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { QueryMarket,QueryAdditionalTypes,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/me/player'].get({
                                query: {QueryMarket,QueryAdditionalTypes,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OneCurrentlyPlaying`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OneCurrentlyPlaying`,
                                properties: OneCurrentlyPlayingFields,
                            });
                        },
                })
                