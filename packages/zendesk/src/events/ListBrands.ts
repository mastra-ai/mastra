
                    import { EventHandler } from '@arkw/core';
                    import { BrandsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListBrands: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-BrandsResponse-ListBrands`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/brands'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListBrands", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `BrandsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `BrandsResponse`,
                                properties: BrandsResponseFields,
                            });
                        },
                })
                