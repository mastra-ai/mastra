
                    import { EventHandler } from '@arkw/core';
                    import { ViewExportResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ExportView: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ViewExportResponse-ExportView`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  view_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/views/{view_id}/export'].get({
                                
                                params: {view_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ExportView", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ViewExportResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ViewExportResponse`,
                                properties: ViewExportResponseFields,
                            });
                        },
                })
                