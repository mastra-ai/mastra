
                    import { EventHandler } from '@arkw/core';
                    import { TicketMetricsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketMetrics: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketMetricsResponse-ListTicketMetrics`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {    } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/ticket_metrics'].get({
                                
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListTicketMetrics", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketMetricsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketMetricsResponse`,
                                properties: TicketMetricsResponseFields,
                            });
                        },
                })
                