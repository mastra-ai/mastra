
                    import { EventHandler } from '@arkw/core';
                    import { SearchCountResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const CountSearchResults: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SearchCountResponse-CountSearchResults`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { query,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/search/count'].get({
                                query: {query,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching CountSearchResults", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SearchCountResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SearchCountResponse`,
                                properties: SearchCountResponseFields,
                            });
                        },
                })
                