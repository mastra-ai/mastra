
                    import { EventHandler } from '@arkw/core';
                    import { ActivitiesResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListActivities: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ActivitiesResponse-ListActivities`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/activities'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListActivities", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ActivitiesResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ActivitiesResponse`,
                                properties: ActivitiesResponseFields,
                            });
                        },
                })
                