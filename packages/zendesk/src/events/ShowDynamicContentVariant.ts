
                    import { EventHandler } from '@arkw/core';
                    import { DynamicContentVariantResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowDynamicContentVariant: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-DynamicContentVariantResponse-ShowDynamicContentVariant`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  dynamic_content_item_id,dynammic_content_variant_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/dynamic_content/items/{dynamic_content_item_id}/variants/{dynammic_content_variant_id}'].get({
                                
                                params: {dynamic_content_item_id,dynammic_content_variant_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowDynamicContentVariant", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `DynamicContentVariantResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `DynamicContentVariantResponse`,
                                properties: DynamicContentVariantResponseFields,
                            });
                        },
                })
                