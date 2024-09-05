
                    import { EventHandler } from '@arkw/core';
                    import { CustomObjectsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListCustomObjects: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-CustomObjectsResponse-ListCustomObjects`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/custom_objects'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListCustomObjects", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `CustomObjectsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `CustomObjectsResponse`,
                                properties: CustomObjectsResponseFields,
                            });
                        },
                })
                