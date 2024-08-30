
                    import { EventHandler } from '@arkw/core';
                    import { CursorPagedPlayHistoryFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -recently-played: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CursorPagedPlayHistory`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { limit,after,before,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/me/player/recently-played'].get({
                                query: {limit,after,before,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CursorPagedPlayHistory`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CursorPagedPlayHistory`,
                                properties: CursorPagedPlayHistoryFields,
                            });
                        },
                })
                