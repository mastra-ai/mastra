
                    import { EventHandler } from '@arkw/core';
                    import { DynamicContentVariantsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const DynamicContentListVariants: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-DynamicContentVariantsResponse-DynamicContentListVariants`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  dynamic_content_item_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/dynamic_content/items/{dynamic_content_item_id}/variants'].get({
                                
                                params: {dynamic_content_item_id,} })

                            if (!response.ok) {
                              console.log("error in fetching DynamicContentListVariants", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `DynamicContentVariantsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `DynamicContentVariantsResponse`,
                                properties: DynamicContentVariantsResponseFields,
                            });
                        },
                })
                