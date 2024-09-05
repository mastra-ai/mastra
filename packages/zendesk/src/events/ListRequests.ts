
                    import { EventHandler } from '@arkw/core';
                    import { RequestsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListRequests: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-RequestsResponse-ListRequests`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { sort_by,sort_order,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/requests'].get({
                                query: {sort_by,sort_order,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListRequests", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `RequestsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `RequestsResponse`,
                                properties: RequestsResponseFields,
                            });
                        },
                })
                