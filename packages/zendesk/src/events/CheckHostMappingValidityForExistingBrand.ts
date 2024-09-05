
                    import { EventHandler } from '@arkw/core';
                    import { HostMappingObjectFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CheckHostMappingValidityForExistingBrand: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-HostMappingObject-CheckHostMappingValidityForExistingBrand`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { BrandId, brand_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/brands/{brand_id}/check_host_mapping'].get({
                                query: {BrandId,},
                                params: {brand_id,} })

                            if (!response.ok) {
                              console.log("error in fetching CheckHostMappingValidityForExistingBrand", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `HostMappingObject`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `HostMappingObject`,
                                properties: HostMappingObjectFields,
                            });
                        },
                })
                