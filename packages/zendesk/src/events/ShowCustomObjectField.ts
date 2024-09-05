
                    import { EventHandler } from '@arkw/core';
                    import { CustomObjectFieldResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowCustomObjectField: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomObjectFieldResponse-ShowCustomObjectField`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { CustomObjectKey,CustomObjectFieldKeyOrId, custom_object_key,custom_object_field_key_or_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/custom_objects/{custom_object_key}/fields/{custom_object_field_key_or_id}'].get({
                                query: {CustomObjectKey,CustomObjectFieldKeyOrId,},
                                params: {custom_object_key,custom_object_field_key_or_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowCustomObjectField", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CustomObjectFieldResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CustomObjectFieldResponse`,
                                properties: CustomObjectFieldResponseFields,
                            });
                        },
                })
                