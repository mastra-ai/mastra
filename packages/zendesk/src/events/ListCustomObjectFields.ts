
                    import { EventHandler } from '@arkw/core';
                    import { CustomObjectFieldsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListCustomObjectFields: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomObjectFieldsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { CustomObjectKey,IncludeStandardFields, custom_object_key,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/custom_objects/{custom_object_key}/fields'].get({
                                query: {CustomObjectKey,IncludeStandardFields,},
                                params: {custom_object_key,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CustomObjectFieldsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CustomObjectFieldsResponse`,
                                properties: CustomObjectFieldsResponseFields,
                            });
                        },
                })
                