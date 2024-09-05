
                    import { EventHandler } from '@arkw/core';
                    import { TriggerCategoryResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowTriggerCategoryById: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TriggerCategoryResponse-ShowTriggerCategoryById`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { trigger_category_id, trigger_category_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/trigger_categories/{trigger_category_id}'].get({
                                query: {trigger_category_id,},
                                params: {trigger_category_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowTriggerCategoryById", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TriggerCategoryResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TriggerCategoryResponse`,
                                properties: TriggerCategoryResponseFields,
                            });
                        },
                })
                