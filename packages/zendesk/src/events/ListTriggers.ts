
                    import { EventHandler } from '@arkw/core';
                    import { TriggersResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTriggers: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TriggersResponse-ListTriggers`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { TriggerActive,TriggerSort,TriggerSortBy,TriggerSortOrder,TriggerCategoryId,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/triggers'].get({
                                query: {TriggerActive,TriggerSort,TriggerSortBy,TriggerSortOrder,TriggerCategoryId,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListTriggers", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TriggersResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TriggersResponse`,
                                properties: TriggersResponseFields,
                            });
                        },
                })
                