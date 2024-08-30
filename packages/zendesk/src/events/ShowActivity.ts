
                    import { EventHandler } from '@arkw/core';
                    import { ActivityResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowActivity: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ActivityResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  activity_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/activities/{activity_id}'].get({
                                
                                params: {activity_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ActivityResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ActivityResponse`,
                                properties: ActivityResponseFields,
                            });
                        },
                })
                