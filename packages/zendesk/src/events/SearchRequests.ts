
                    import { EventHandler } from '@arkw/core';
                    import { RequestsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const SearchRequests: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-RequestsResponse-SearchRequests`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { query,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/requests/search'].get({
                                query: {query,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching SearchRequests", {response});
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
                