
                    import { EventHandler } from '@arkw/core';
                    import { TicketMetricsByTicketMetricIdResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ShowTicketMetrics: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketMetricsByTicketMetricIdResponse-ShowTicketMetrics`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { ticket_metric_id, ticket_metric_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/ticket_metrics/{ticket_metric_id}'].get({
                                query: {ticket_metric_id,},
                                params: {ticket_metric_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ShowTicketMetrics", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketMetricsByTicketMetricIdResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketMetricsByTicketMetricIdResponse`,
                                properties: TicketMetricsByTicketMetricIdResponseFields,
                            });
                        },
                })
                