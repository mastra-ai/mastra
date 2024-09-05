
                    import { EventHandler } from '@arkw/core';
                    import { ActivitiesCountResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CountActivities: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ActivitiesCountResponse-CountActivities`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/activities/count'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching CountActivities", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ActivitiesCountResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ActivitiesCountResponse`,
                                properties: ActivitiesCountResponseFields,
                            });
                        },
                })
                