
                    import { EventHandler } from '@arkw/core';
                    import { SupportAddressResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowSupportAddress: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SupportAddressResponse-ShowSupportAddress`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  support_address_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/recipient_addresses/{support_address_id}'].get({
                                
                                params: {support_address_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowSupportAddress", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SupportAddressResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SupportAddressResponse`,
                                properties: SupportAddressResponseFields,
                            });
                        },
                })
                