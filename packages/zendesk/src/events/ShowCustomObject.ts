
                    import { EventHandler } from '@arkw/core';
                    import { CustomObjectResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowCustomObject: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomObjectResponse-ShowCustomObject`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { CustomObjectKey, custom_object_key,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/custom_objects/{custom_object_key}'].get({
                                query: {CustomObjectKey,},
                                params: {custom_object_key,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowCustomObject", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CustomObjectResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CustomObjectResponse`,
                                properties: CustomObjectResponseFields,
                            });
                        },
                })
                