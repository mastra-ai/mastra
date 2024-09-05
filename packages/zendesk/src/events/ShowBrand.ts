
                    import { EventHandler } from '@arkw/core';
                    import { BrandResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowBrand: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-BrandResponse-ShowBrand`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { BrandId, brand_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/brands/{brand_id}'].get({
                                query: {BrandId,},
                                params: {brand_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowBrand", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `BrandResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `BrandResponse`,
                                properties: BrandResponseFields,
                            });
                        },
                })
                