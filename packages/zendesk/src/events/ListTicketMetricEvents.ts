
                    import { EventHandler } from '@arkw/core';
                    import { TicketMetricEventsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketMetricEvents: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketMetricEventsResponse`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { start_time,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            const response = await proxy['/api/v2/incremental/ticket_metric_events'].get({
                                query: {start_time,},
                                 })

                            if (!response.ok) {
                            return
                            }

                            const d = await response.json()

                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketMetricEventsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketMetricEventsResponse`,
                                properties: TicketMetricEventsResponseFields,
                            });
                        },
                })
                