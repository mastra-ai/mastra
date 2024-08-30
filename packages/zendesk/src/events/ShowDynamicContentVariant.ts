
                    import { EventHandler } from '@arkw/core';
                    import { DynamicContentVariantResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowDynamicContentVariant: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-DynamicContentVariantResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  dynamic_content_item_id,dynammic_content_variant_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/dynamic_content/items/{dynamic_content_item_id}/variants/{dynammic_content_variant_id}'].get({
                                
                                params: {dynamic_content_item_id,dynammic_content_variant_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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
                