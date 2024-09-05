
                    import { EventHandler } from '@arkw/core';
                    import { CustomObjectLimitsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CustomObjectFieldsLimit: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomObjectLimitsResponse-CustomObjectFieldsLimit`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { CustomObjectKey, custom_object_key,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/custom_objects/{custom_object_key}/limits/field_limit'].get({
                                query: {CustomObjectKey,},
                                params: {custom_object_key,} })

                            if (!response.ok) {
                              console.log("error in fetching CustomObjectFieldsLimit", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CustomObjectLimitsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CustomObjectLimitsResponse`,
                                properties: CustomObjectLimitsResponseFields,
                            });
                        },
                })
                