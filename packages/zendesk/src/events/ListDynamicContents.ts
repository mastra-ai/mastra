
                    import { EventHandler } from '@arkw/core';
                    import { DynamicContentsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListDynamicContents: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-DynamicContentsResponse-ListDynamicContents`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/dynamic_content/items'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListDynamicContents", {response});
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
                