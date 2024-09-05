
                    import { EventHandler } from '@arkw/core';
                    import { CustomObjectRecordsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const AutocompleteCustomObjectRecordSearch: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomObjectRecordsResponse-AutocompleteCustomObjectRecordSearch`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { CustomObjectKey,name,page[before],page[after],page[size],field_id,source,requester_id,assignee_id,organization_id, custom_object_key,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/custom_objects/{custom_object_key}/records/autocomplete'].get({
                                query: {CustomObjectKey,name,page[before],page[after],page[size],field_id,source,requester_id,assignee_id,organization_id,},
                                params: {custom_object_key,} })

                            if (!response.ok) {
                              console.log("error in fetching AutocompleteCustomObjectRecordSearch", {response});
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
                