
                    import { EventHandler } from '@arkw/core';
                    import { ReverseLookupResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const GetSourcesByTar: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ReverseLookupResponse-GetSourcesByTar`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { target_type,target_id,field_id,source_type, target_type,target_id,field_id,source_type,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/{target_type}/{target_id}/relationship_fields/{field_id}/{source_type}'].get({
                                query: {target_type,target_id,field_id,source_type,},
                                params: {target_type,target_id,field_id,source_type,} })

                            if (!response.ok) {
                              console.log("error in fetching GetSourcesByTar", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ReverseLookupResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ReverseLookupResponse`,
                                properties: ReverseLookupResponseFields,
                            });
                        },
                })
                