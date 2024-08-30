
                    import { EventHandler } from '@arkw/core';
                    import { DynamicContentsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowManyDynamicContents: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-DynamicContentsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { identifiers,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/dynamic_content/items/show_many'].get({
                                query: {identifiers,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `DynamicContentsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `DynamicContentsResponse`,
                                properties: DynamicContentsResponseFields,
                            });
                        },
                })
                