
                    import { EventHandler } from '@arkw/core';
                    import { ObjectTriggerResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const GetObjectTrigger: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ObjectTriggerResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  custom_object_key,trigger_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/custom_objects/{custom_object_key}/triggers/{trigger_id}'].get({
                                
                                params: {custom_object_key,trigger_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ObjectTriggerResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ObjectTriggerResponse`,
                                properties: ObjectTriggerResponseFields,
                            });
                        },
                })
                