
                    import { EventHandler } from '@arkw/core';
                    import { DynamicContentResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowDynamicContentItem: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-DynamicContentResponse-ShowDynamicContentItem`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  dynamic_content_item_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/dynamic_content/items/{dynamic_content_item_id}'].get({
                                
                                params: {dynamic_content_item_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowDynamicContentItem", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `DynamicContentResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `DynamicContentResponse`,
                                properties: DynamicContentResponseFields,
                            });
                        },
                })
                