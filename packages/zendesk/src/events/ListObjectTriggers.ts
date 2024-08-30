
                    import { EventHandler } from '@arkw/core';
                    import { ObjectTriggersResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListObjectTriggers: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ObjectTriggersResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { TriggerActive,TriggerSortBy,TriggerSortOrder, custom_object_key,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/custom_objects/{custom_object_key}/triggers'].get({
                                query: {TriggerActive,TriggerSortBy,TriggerSortOrder,},
                                params: {custom_object_key,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ObjectTriggersResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ObjectTriggersResponse`,
                                properties: ObjectTriggersResponseFields,
                            });
                        },
                })
                