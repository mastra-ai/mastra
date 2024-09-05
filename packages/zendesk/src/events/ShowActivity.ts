
                    import { EventHandler } from '@arkw/core';
                    import { ActivityResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowActivity: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ActivityResponse-ShowActivity`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  activity_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/activities/{activity_id}'].get({
                                
                                params: {activity_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowActivity", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
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
                