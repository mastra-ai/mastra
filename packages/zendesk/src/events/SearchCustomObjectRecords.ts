
                    import { EventHandler } from '@arkw/core';
                    import { CustomObjectRecordsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const SearchCustomObjectRecords: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomObjectRecordsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { CustomObjectKey,query,sort,page[before],page[after],page[size], custom_object_key,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/custom_objects/{custom_object_key}/records/search'].get({
                                query: {CustomObjectKey,query,sort,page[before],page[after],page[size],},
                                params: {custom_object_key,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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
                