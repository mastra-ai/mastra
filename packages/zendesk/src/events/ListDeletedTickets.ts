
                    import { EventHandler } from '@arkw/core';
                    import { ListDeletedTicketsResponseFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListDeletedTickets: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-ListDeletedTicketsResponse-ListDeletedTickets`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const { TicketSortBy,TicketSortOrder,   } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/deleted_tickets'].get({
                                query: {TicketSortBy,TicketSortOrder,},
                                 })

                            if (!response.ok) {
                              console.log("error in fetching ListDeletedTickets", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `ListDeletedTicketsResponse`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `ListDeletedTicketsResponse`,
                                properties: ListDeletedTicketsResponseFields,
                            });
                        },
                })
                