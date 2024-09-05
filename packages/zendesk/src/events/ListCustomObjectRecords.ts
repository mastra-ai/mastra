
                    import { EventHandler } from '@arkw/core';
                    import { CustomObjectRecordsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListCustomObjectRecords: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomObjectRecordsResponse-ListCustomObjectRecords`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { CustomObjectKey,filter[ids],filter[external_ids],sort,page[before],page[after],page[size], custom_object_key,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/custom_objects/{custom_object_key}/records'].get({
                                query: {CustomObjectKey,filter[ids],filter[external_ids],sort,page[before],page[after],page[size],},
                                params: {custom_object_key,} })

                            if (!response.ok) {
                              console.log("error in fetching ListCustomObjectRecords", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CustomObjectRecordsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CustomObjectRecordsResponse`,
                                properties: CustomObjectRecordsResponseFields,
                            });
                        },
                })
                