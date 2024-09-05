
                    import { EventHandler } from '@arkw/core';
                    import { ObjectTriggerDefinitionResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListObjectTriggersDefinitions: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ObjectTriggerDefinitionResponse-ListObjectTriggersDefinitions`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  custom_object_key,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/custom_objects/{custom_object_key}/triggers/definitions'].get({
                                
                                params: {custom_object_key,} })

                            if (!response.ok) {
                              console.log("error in fetching ListObjectTriggersDefinitions", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ObjectTriggerDefinitionResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ObjectTriggerDefinitionResponse`,
                                properties: ObjectTriggerDefinitionResponseFields,
                            });
                        },
                })
                