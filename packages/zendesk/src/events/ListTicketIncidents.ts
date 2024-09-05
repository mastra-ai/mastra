
                    import { EventHandler } from '@arkw/core';
                    import { ListTicketIncidentsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListTicketIncidents: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ListTicketIncidentsResponse-ListTicketIncidents`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { TicketId, ticket_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/tickets/{ticket_id}/incidents'].get({
                                query: {TicketId,},
                                params: {ticket_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ListTicketIncidents", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ListTicketIncidentsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ListTicketIncidentsResponse`,
                                properties: ListTicketIncidentsResponseFields,
                            });
                        },
                })
                