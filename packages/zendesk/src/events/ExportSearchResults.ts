
                    import { EventHandler } from '@arkw/core';
                    import { SearchExportResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ExportSearchResults: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-SearchExportResponse-ExportSearchResults`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { query,page[size],filter[type],   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/search/export'].get({
                                query: {query,page[size],filter[type],},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ExportSearchResults", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `SearchExportResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `SearchExportResponse`,
                                properties: SearchExportResponseFields,
                            });
                        },
                })
                