
                    import { EventHandler } from '@arkw/core';
                    import { ObjectTriggersResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const SearchObjectTriggers: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ObjectTriggersResponse-SearchObjectTriggers`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  custom_object_key,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/custom_objects/{custom_object_key}/triggers/search'].get({
                                
                                params: {custom_object_key,} })

                            if (!response.ok) {
                              console.log("error in fetching SearchObjectTriggers", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ObjectTriggersResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ObjectTriggersResponse`,
                                properties: ObjectTriggersResponseFields,
                            });
                        },
                })
                