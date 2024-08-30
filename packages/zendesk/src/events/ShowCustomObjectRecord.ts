
                    import { EventHandler } from '@arkw/core';
                    import { CustomObjectRecordResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowCustomObjectRecord: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomObjectRecordResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { CustomObjectKey,CustomObjectRecordId, custom_object_key,custom_object_record_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/custom_objects/{custom_object_key}/records/{custom_object_record_id}'].get({
                                query: {CustomObjectKey,CustomObjectRecordId,},
                                params: {custom_object_key,custom_object_record_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CustomObjectRecordResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CustomObjectRecordResponse`,
                                properties: CustomObjectRecordResponseFields,
                            });
                        },
                })
                