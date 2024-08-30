
                    import { EventHandler } from '@arkw/core';
                    import { ViewExportResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ExportView: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ViewExportResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  view_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/views/{view_id}/export'].get({
                                
                                params: {view_id,} })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

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
                