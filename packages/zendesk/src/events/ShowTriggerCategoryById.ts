
                    import { EventHandler } from '@arkw/core';
                    import { TriggerCategoryResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowTriggerCategoryById: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TriggerCategoryResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { trigger_category_id, trigger_category_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/trigger_categories/{trigger_category_id}'].get({
                                query: {trigger_category_id,},
                                params: {trigger_category_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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
                