
                    import { EventHandler } from '@arkw/core';
                    import { OnePublicUserFields } from '../constants';
                    import { SpotifyIntegration } from '..';

                    export const -users-profile: EventHandler<SpotifyIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-OnePublicUser`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { PathUserId, user_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/users/{user_id}'].get({
                                query: {PathUserId,},
                                params: {user_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `OnePublicUser`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `OnePublicUser`,
                                properties: OnePublicUserFields,
                            });
                        },
                })
                