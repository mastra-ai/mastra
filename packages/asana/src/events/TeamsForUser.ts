
                    import { EventHandler } from '@arkw/core';
                    import { TeamCompactFields } from '../constants';
                    import { AsanaIntegration } from '..';

                    export const TeamsForUser: EventHandler<AsanaIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TeamCompact`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  user_gid,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/users/{user_gid}/teams'].get({
                                
                                params: {user_gid,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TeamCompact`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TeamCompact`,
                                properties: TeamCompactFields,
                            });
                        },
                })
                