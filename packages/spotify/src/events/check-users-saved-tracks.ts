
                    import { EventHandler } from '@arkw/core';
                    import { ArrayOfBooleansFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const check-users-saved-tracks: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ArrayOfBooleans`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { QueryTrackIds,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/me/tracks/contains'].get({
                                query: {QueryTrackIds,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ArrayOfBooleans`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ArrayOfBooleans`,
                                properties: ArrayOfBooleansFields,
                            });
                        },
                })
                