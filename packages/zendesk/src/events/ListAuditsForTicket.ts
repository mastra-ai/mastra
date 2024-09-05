
                    import { EventHandler } from '@arkw/core';
                    import { TicketAuditsResponseNoneCursorFields } from '../constants';
                    import { ZendeskIntegration } from '..';

                    export const ListAuditsForTicket: EventHandler<ZendeskIntegration> = ({
  eventKey,
  integrationInstance: { name, dataLayer, getApiClient },
  makeWebhookUrl,
}) => ({
                        id: `${name}-sync-TicketAuditsResponseNoneCursor-ListAuditsForTicket`,
                        event: eventKey,
                        executor: async ({ event, step }: any) => {
                            const {  ticket_id,  } = event.data;
                            const { referenceId } = event.user;
                            const proxy = await getApiClient({ referenceId })


                            // @ts-ignore
                            const response = await proxy['/api/v2/tickets/{ticket_id}/audits'].get({
                                
                                params: {ticket_id,} })

                            if (!response.ok) {
                              console.log("error in fetching ListAuditsForTicket", {response});
                              return
                            }

                            const d = await response.json()

                            // @ts-ignore
                            const records = d?.data?.map(({ _externalId, ...d2 }) => ({
                                externalId: _externalId,
                                data: d2,
                                entityType: `TicketAuditsResponseNoneCursor`,
                            }));

                            await dataLayer?.syncData({
                                name,
                                referenceId,
                                data: records,
                                type: `TicketAuditsResponseNoneCursor`,
                                properties: TicketAuditsResponseNoneCursorFields,
                            });
                        },
                })
                