
                    import { EventHandler } from '@arkw/core';
                    import { DynamicContentsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowManyDynamicContents: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-DynamicContentsResponse-ShowManyDynamicContents`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { identifiers,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/dynamic_content/items/show_many'].get({
                                query: {identifiers,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ShowManyDynamicContents", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
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
                